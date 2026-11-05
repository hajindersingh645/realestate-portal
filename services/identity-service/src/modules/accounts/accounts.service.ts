import { EXCHANGES, type AccountStatus, type AccountType } from '@hanu/contracts';
import {
  audit,
  ConflictError,
  ForbiddenError,
  internalGet,
  NotFoundError,
  sql,
  uuidv7,
  ValidationError,
  withDbErrors,
  type Actor,
  type Em,
} from '@hanu/service-kit';
import { accessChanged } from '../access/index.js';
import { slugify } from './slug.js';

export interface AccountDeps {
  /** catalog-service base URL for `/internal/locations` (inside the network, not the gateway). */
  catalogUrl: string;
}

export interface AccountInput {
  type: AccountType;
  displayName: string;
  about?: string;
  experienceYears?: number;
  specialisations?: string[];
  licenseNumber?: string;
  locationIds: string[];
}

export type AccountUpdate = Partial<Omit<AccountInput, 'type'>> & { slug?: string };

export interface Area {
  locationId: string;
  cityId: string;
}

export interface MyAccountView {
  id: string;
  type: AccountType;
  displayName: string;
  slug: string;
  about: string | null;
  experienceYears: number | null;
  specialisations: string[];
  licenseNumber: string | null;
  status: AccountStatus;
  areas: Area[];
  /** The latest staff reason, only while the account is rejected. */
  rejectReason: string | null;
  license: { label: string; mandatory: boolean };
}

/** Statuses in which the owner may edit the profile. Suspended and banned accounts are frozen. */
const EDITABLE: readonly AccountStatus[] = ['pending', 'rejected', 'approved'];
/** The slug is public once approved, so it is fixed from then on. */
const SLUG_EDITABLE: readonly AccountStatus[] = ['pending', 'rejected'];

const MY_ACCOUNT_ID = `(select account_id from account_members where user_id = ? and status = 'active')`;

interface LocationAnswer {
  id: string;
  type: string;
  cityId: string | null;
  isActive: boolean;
}

/**
 * Asks catalog about the areas. Every id must be a live city or locality; the city is copied so
 * later filters by city need no call. Runs before any transaction, so no lock waits on catalog.
 */
async function resolveAreas(deps: AccountDeps, ids: readonly string[]): Promise<Area[]> {
  const unique = [...new Set(ids)];
  const { data } = await internalGet<{ data: LocationAnswer[] }>(
    deps.catalogUrl,
    `/internal/locations?ids=${unique.join(',')}`,
  );
  const found = new Map(data.map((location) => [location.id, location]));
  return unique.map((id) => {
    const location = found.get(id);
    if (location === undefined || !location.isActive || location.cityId === null) {
      throw new ValidationError('body/locationIds Each area must be an active city or locality');
    }
    return { locationId: id, cityId: location.cityId };
  });
}

async function licenseSettings(em: Em): Promise<{ label: string; mandatory: boolean }> {
  // `value` is jsonb, so the driver returns it parsed.
  const rows = await sql<{ key: string; value: unknown }>(
    em,
    `select distinct on (key) key, value from settings
      where key in ('license.label', 'license.mandatory') order by key, version desc`,
  );
  const value = new Map(rows.map((row) => [row.key, row.value]));
  const label = value.get('license.label');
  return {
    label: typeof label === 'string' ? label : 'Licence',
    mandatory: value.get('license.mandatory') === true,
  };
}

async function replaceAreas(em: Em, accountId: string, areas: readonly Area[]): Promise<void> {
  await sql(em, 'delete from account_locations where account_id = ?', [accountId]);
  await sql(
    em,
    `insert into account_locations (account_id, location_id, city_id)
     select ?, (e->>'locationId')::uuid, (e->>'cityId')::uuid from jsonb_array_elements(?::jsonb) e`,
    [accountId, JSON.stringify(areas)],
  );
}

async function recordTransition(
  em: Em,
  actor: Actor,
  accountId: string,
  from: AccountStatus | null,
  to: AccountStatus,
  reason: string | null,
): Promise<void> {
  await sql(
    em,
    `insert into account_transitions (id, account_id, from_status, to_status, reason, actor_user_id, created_at)
     values (?, ?, ?, ?, ?, ?, now())`,
    [uuidv7(), accountId, from, to, reason, actor.userId],
  );
}

function userIdOf(actor: Actor): string {
  if (actor.userId === null) throw new ForbiddenError();
  return actor.userId;
}

/**
 * A signed-in user becomes the owner of a new, pending professional account. One account per
 * user (unique index); only a user who signed up as a professional can own one
 * (one phone number, one side). The slug is the first free one of `name`,
 * `name-2` … `name-50`, chosen inside the insert; deleted accounts keep their slug.
 */
export async function createAccount(
  em: Em,
  actor: Actor,
  deps: AccountDeps,
  input: AccountInput,
): Promise<MyAccountView> {
  const userId = userIdOf(actor);
  const license = await licenseSettings(em);
  if (license.mandatory && (input.licenseNumber ?? '').trim() === '') {
    throw new ValidationError(`body/licenseNumber ${license.label} number is required`);
  }
  const areas = await resolveAreas(deps, input.locationIds);
  const base = slugify(input.displayName);
  return await em.transactional(async (tx) => {
    const accountId = crypto.randomUUID();
    const created = await sql<{ id: string }>(
      tx,
      `insert into accounts (id, type, display_name, slug, about, experience_years, specialisations,
                             license_number, status, created_at, updated_at)
       select ?, ?, ?, c.slug, ?, ?, array(select jsonb_array_elements_text(?::jsonb)), ?, 'pending', now(), now()
         from (select case when n = 1 then ?::text else ?::text || '-' || n end as slug, n
                 from generate_series(1, 50) n) c
        where not exists (select 1 from accounts a where a.slug = c.slug)
        order by c.n limit 1
       returning id`,
      [
        accountId,
        input.type,
        input.displayName.trim(),
        input.about ?? null,
        input.experienceYears ?? null,
        JSON.stringify(input.specialisations ?? []),
        input.licenseNumber?.trim() ?? null,
        base,
        base,
      ],
    );
    if (created[0] === undefined)
      throw new ConflictError('No free profile address; change the name');
    const owner = await withDbErrors(
      () =>
        sql<{ id: string }>(
          tx,
          `insert into account_members (id, account_id, user_id, member_role, status, joined_at)
           select ?, ?, u.id, 'owner', 'active', now() from users u
            where u.id = ? and u.registered_as = 'professional' and u.deleted_at is null
           returning id`,
          [crypto.randomUUID(), accountId, userId],
        ),
      { unique: 'You already have a professional account' },
    );
    if (owner[0] === undefined)
      throw new ForbiddenError('Only professional sign-ups can own a profile');
    await replaceAreas(tx, accountId, areas);
    await recordTransition(tx, actor, accountId, null, 'pending', null);
    await audit(tx, EXCHANGES.identity, actor, {
      action: 'account.created',
      targetType: 'account',
      targetId: accountId,
    });
    // The new role and `acc` claim reach the user at their next refresh; tokens before now are refused.
    await accessChanged(tx, actor.service, [userId]);
    return await getMyAccount(tx, userId);
  });
}

interface AccountRow {
  id: string;
  type: AccountType;
  display_name: string;
  slug: string;
  about: string | null;
  experience_years: number | null;
  specialisations: string[];
  license_number: string | null;
  status: AccountStatus;
  areas: Area[];
  reject_reason: string | null;
}

/** The caller's own account, with areas and the latest reject reason. */
export async function getMyAccount(em: Em, userId: string): Promise<MyAccountView> {
  const rows = await sql<AccountRow>(
    em,
    `select a.id, a.type, a.display_name, a.slug, a.about, a.experience_years, a.specialisations,
            a.license_number, a.status,
            coalesce((select json_agg(json_build_object('locationId', l.location_id, 'cityId', l.city_id)
                                      order by l.location_id)
                        from account_locations l where l.account_id = a.id), '[]') as areas,
            (select t.reason from account_transitions t
              where t.account_id = a.id and t.to_status = 'rejected'
              order by t.created_at desc limit 1) as reject_reason
       from account_members m
       join accounts a on a.id = m.account_id and a.deleted_at is null
      where m.user_id = ? and m.status = 'active'`,
    [userId],
  );
  const row = rows[0];
  if (row === undefined) throw new NotFoundError('No professional account yet');
  return {
    id: row.id,
    type: row.type,
    displayName: row.display_name,
    slug: row.slug,
    about: row.about,
    experienceYears: row.experience_years,
    specialisations: row.specialisations,
    licenseNumber: row.license_number,
    status: row.status,
    areas: row.areas,
    rejectReason: row.status === 'rejected' ? row.reject_reason : null,
    license: await licenseSettings(em),
  };
}

/** Column for each editable field. Fixed names only: nothing from the request becomes SQL. */
const COLUMNS = new Map<keyof AccountUpdate, string>([
  ['displayName', 'display_name'],
  ['about', 'about'],
  ['experienceYears', 'experience_years'],
  ['licenseNumber', 'license_number'],
  ['slug', 'slug'],
]);

/**
 * Edits the caller's own account. Ownership is the `where` (no account id comes from the
 * client). Editing an approved account keeps it approved; staff see the change in the audit log.
 */
export async function updateMyAccount(
  em: Em,
  actor: Actor,
  deps: AccountDeps,
  input: AccountUpdate,
): Promise<MyAccountView> {
  const userId = userIdOf(actor);
  const areas =
    input.locationIds === undefined ? undefined : await resolveAreas(deps, input.locationIds);
  return await em.transactional(async (tx) => {
    const before = await getMyAccount(tx, userId);
    const sets: string[] = ['updated_at = now()'];
    const params: unknown[] = [];
    // `unknown`: a caller may pass `{ about: undefined }`, which means "no change".
    for (const [field, value] of Object.entries(input) as [string, unknown][]) {
      const column = COLUMNS.get(field as keyof AccountUpdate);
      if (column === undefined || value === undefined) continue;
      sets.push(`${column} = ?`);
      params.push(typeof value === 'string' ? value.trim() : value);
    }
    if (input.specialisations !== undefined) {
      sets.push('specialisations = array(select jsonb_array_elements_text(?::jsonb))');
      params.push(JSON.stringify(input.specialisations));
    }
    const allowed = input.slug === undefined ? EDITABLE : SLUG_EDITABLE;
    const updated = await withDbErrors(
      () =>
        sql<{ id: string }>(
          tx,
          `update accounts set ${sets.join(', ')}
            where id = ${MY_ACCOUNT_ID} and deleted_at is null
              and status in (${allowed.map(() => '?').join(', ')})
           returning id`,
          [...params, userId, ...allowed],
        ),
      { unique: 'This profile address is taken' },
    );
    if (updated[0] === undefined) {
      throw new ConflictError(
        input.slug !== undefined && before.status === 'approved'
          ? 'The profile address cannot change after approval'
          : `A ${before.status} account cannot be edited`,
      );
    }
    if (areas !== undefined) await replaceAreas(tx, before.id, areas);
    const after = await getMyAccount(tx, userId);
    await audit(tx, EXCHANGES.identity, actor, {
      action: 'account.updated',
      targetType: 'account',
      targetId: before.id,
      diff: { before, after },
    });
    return after;
  });
}

/** After a rejection, the owner sends the edited profile back to the queue. */
export async function resubmitMyAccount(em: Em, actor: Actor): Promise<MyAccountView> {
  const userId = userIdOf(actor);
  return await em.transactional(async (tx) => {
    const before = await getMyAccount(tx, userId);
    const moved = await sql<{ id: string }>(
      tx,
      `update accounts set status = 'pending', updated_at = now()
        where id = ${MY_ACCOUNT_ID} and deleted_at is null and status = 'rejected'
       returning id`,
      [userId],
    );
    if (moved[0] === undefined) {
      throw new ConflictError(`A ${before.status} account cannot be resubmitted`);
    }
    await recordTransition(tx, actor, before.id, 'rejected', 'pending', null);
    await audit(tx, EXCHANGES.identity, actor, {
      action: 'account.resubmitted',
      targetType: 'account',
      targetId: before.id,
    });
    await accessChanged(tx, actor.service, [userId]);
    return await getMyAccount(tx, userId);
  });
}

export interface AccountLookup {
  id: string;
  slug: string;
  displayName: string;
  type: AccountType;
  licenseNumber: string | null;
  status: AccountStatus;
}

/** For other services (lead's "Unlocked by"): live accounts among `ids`, any status. */
export async function lookupAccounts(em: Em, ids: readonly string[]): Promise<AccountLookup[]> {
  if (ids.length === 0) return [];
  return await sql<AccountLookup>(
    em,
    `select id, slug, display_name as "displayName", type, license_number as "licenseNumber", status
       from accounts where deleted_at is null and id in (${ids.map(() => '?').join(', ')})
      order by id`,
    [...ids],
  );
}
