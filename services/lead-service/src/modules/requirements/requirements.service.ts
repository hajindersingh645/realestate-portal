import { EXCHANGES, type RequirementStatus } from '@hanu/contracts';
import {
  audit,
  ConflictError,
  decodeCursor,
  encodeCursor,
  ForbiddenError,
  internalGet,
  NotFoundError,
  resolveAreas,
  resolvePropertyType,
  sql,
  uuidv7,
  ValidationError,
  type Actor,
  type Area,
  type Em,
} from '@hanu/service-kit';
import { findContactDetails } from './contact-check.js';
import type { MyRequirement, RequirementInput, RequirementUpdate } from './requirements.schemas.js';

export interface RequirementDeps {
  /** catalog-service inside the network, for `/internal/*`. */
  catalogUrl: string;
  /** identity-service inside the network, for the buyer's contact. */
  identityUrl: string;
}

/** The buyer may edit only before review or after a rejection. */
const EDITABLE: readonly RequirementStatus[] = ['draft', 'rejected'];
const PAGE = 50;
const ISO = `'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'`;
const iso = (column: string) => `to_char(${column} at time zone 'UTC', ${ISO})`;

/** Every column of the buyer's view, for `from requirements r`. */
const VIEW = `r.id, r.status, r.purpose, r.property_type_id as "propertyTypeId",
  coalesce((select json_agg(json_build_object('locationId', l.location_id, 'cityId', l.city_id)
                            order by l.location_id)
              from requirement_locations l where l.requirement_id = r.id), '[]') as areas,
  r.budget_min::text as "budgetMin", r.budget_max::text as "budgetMax", r.bedrooms,
  trim_scale(r.area_min)::text as "areaMin", trim_scale(r.area_max)::text as "areaMax", r.area_unit as "areaUnit",
  r.possession, r.timeline, r.loan_needed as "loanNeeded", r.preferences, r.notes,
  r.unlock_count as "unlockCount", r.max_unlocks as "maxUnlocks", r.fee_type as "feeType",
  ${iso('r.submitted_at')} as "submittedAt", ${iso('r.published_at')} as "publishedAt",
  ${iso('r.expires_at')} as "expiresAt", ${iso('r.closed_at')} as "closedAt",
  ${iso('r.created_at')} as "createdAt",
  case when r.status = 'rejected' then
    (select t.reason from state_transitions t
      where t.entity_type = 'requirement' and t.entity_id = r.id and t.to_state = 'rejected'
      order by t.created_at desc limit 1) end as "rejectReason"`;

/** Fixed column names for the plain fields. Nothing from the request becomes SQL. */
const COLUMNS = new Map<string, string>([
  ['purpose', 'purpose'],
  ['propertyTypeId', 'property_type_id'],
  ['budgetMin', 'budget_min'],
  ['budgetMax', 'budget_max'],
  ['areaMin', 'area_min'],
  ['areaMax', 'area_max'],
  ['areaUnit', 'area_unit'],
  ['possession', 'possession'],
  ['timeline', 'timeline'],
  ['loanNeeded', 'loan_needed'],
  ['notes', 'notes'],
]);

function checkRanges(input: RequirementUpdate): void {
  if (
    input.budgetMin !== undefined &&
    input.budgetMax !== undefined &&
    BigInt(input.budgetMin) > BigInt(input.budgetMax)
  ) {
    throw new ValidationError('body/budgetMax The maximum budget must be at least the minimum');
  }
  if (
    input.areaMin !== undefined &&
    input.areaMax !== undefined &&
    Number(input.areaMin) > Number(input.areaMax)
  ) {
    throw new ValidationError('body/areaMax The maximum area must be at least the minimum');
  }
}

/** Catalog checks, before any transaction so no lock waits on catalog. */
async function resolveInput(
  deps: RequirementDeps,
  input: RequirementUpdate,
): Promise<Area[] | undefined> {
  checkRanges(input);
  if (input.propertyTypeId !== undefined) {
    await resolvePropertyType(deps.catalogUrl, input.propertyTypeId);
  }
  return input.locationIds === undefined
    ? undefined
    : await resolveAreas(deps.catalogUrl, input.locationIds);
}

async function replaceAreas(em: Em, requirementId: string, areas: readonly Area[]): Promise<void> {
  await sql(em, 'delete from requirement_locations where requirement_id = ?', [requirementId]);
  await sql(
    em,
    `insert into requirement_locations (requirement_id, location_id, city_id)
     select ?, (e->>'locationId')::uuid, (e->>'cityId')::uuid from jsonb_array_elements(?::jsonb) e`,
    [requirementId, JSON.stringify(areas)],
  );
}

/** One history row per status change, in the kit's append-only `state_transitions`. */
export async function recordTransition(
  em: Em,
  actor: Actor,
  requirementId: string,
  from: RequirementStatus | null,
  to: RequirementStatus,
  reason: string | null = null,
): Promise<void> {
  await sql(
    em,
    `insert into state_transitions (id, entity_type, entity_id, from_state, to_state, actor_user_id, reason, created_at)
     values (?, 'requirement', ?, ?, ?, ?, ?, now())`,
    [uuidv7(), requirementId, from, to, actor.userId, reason],
  );
}

function buyerOf(actor: Actor): string {
  if (actor.userId === null) throw new NotFoundError('Requirement not found');
  return actor.userId;
}

/** A buyer's new requirement, saved as a draft (nothing is checked for contact details yet). */
export async function createRequirement(
  em: Em,
  actor: Actor,
  deps: RequirementDeps,
  input: RequirementInput,
): Promise<MyRequirement> {
  const buyerId = buyerOf(actor);
  const areas = (await resolveInput(deps, input)) ?? [];
  return await em.transactional(async (tx) => {
    const id = crypto.randomUUID();
    await sql(
      tx,
      `insert into requirements (id, buyer_id, status, purpose, property_type_id, budget_min, budget_max,
                                 bedrooms, area_min, area_max, area_unit, possession, timeline,
                                 loan_needed, preferences, notes, created_at, updated_at)
       values (?, ?, 'draft', ?, ?, ?, ?, ?::int[], ?, ?, ?, ?, ?, ?, ?::jsonb, ?, now(), now())`,
      [
        id,
        buyerId,
        input.purpose,
        input.propertyTypeId,
        input.budgetMin,
        input.budgetMax,
        `{${(input.bedrooms ?? []).join(',')}}`,
        input.areaMin ?? null,
        input.areaMax ?? null,
        input.areaUnit ?? null,
        input.possession ?? null,
        input.timeline ?? null,
        input.loanNeeded ?? null,
        JSON.stringify(input.preferences ?? {}),
        input.notes?.trim() ?? null,
      ],
    );
    await replaceAreas(tx, id, areas);
    await recordTransition(tx, actor, id, null, 'draft');
    return await getMyRequirement(tx, actor, id);
  });
}

/** Edits a draft or a rejected requirement. Ownership and state are the `where`. */
export async function updateMyRequirement(
  em: Em,
  actor: Actor,
  deps: RequirementDeps,
  id: string,
  input: RequirementUpdate,
): Promise<MyRequirement> {
  const buyerId = buyerOf(actor);
  const areas = await resolveInput(deps, input);
  return await em.transactional(async (tx) => {
    const before = await getMyRequirement(tx, actor, id);
    checkRanges({
      budgetMin: input.budgetMin ?? before.budgetMin,
      budgetMax: input.budgetMax ?? before.budgetMax,
      ...((input.areaMin ?? before.areaMin) === null
        ? {}
        : { areaMin: input.areaMin ?? before.areaMin ?? undefined }),
      ...((input.areaMax ?? before.areaMax) === null
        ? {}
        : { areaMax: input.areaMax ?? before.areaMax ?? undefined }),
    });
    const sets = ['updated_at = now()'];
    const params: unknown[] = [];
    // `unknown`: a caller may pass `{ notes: undefined }`, which means "no change".
    for (const [field, value] of Object.entries(input) as [string, unknown][]) {
      const column = COLUMNS.get(field);
      if (column === undefined || value === undefined) continue;
      sets.push(`${column} = ?`);
      params.push(typeof value === 'string' ? value.trim() : value);
    }
    if (input.bedrooms !== undefined) {
      sets.push('bedrooms = ?::int[]');
      params.push(`{${input.bedrooms.join(',')}}`);
    }
    if (input.preferences !== undefined) {
      sets.push('preferences = ?::jsonb');
      params.push(JSON.stringify(input.preferences));
    }
    const updated = await sql<{ id: string }>(
      tx,
      `update requirements set ${sets.join(', ')}
        where id = ? and buyer_id = ? and deleted_at is null
          and status in (${EDITABLE.map(() => '?').join(', ')})
       returning id`,
      [...params, id, buyerId, ...EDITABLE],
    );
    if (updated[0] === undefined) {
      throw new ConflictError(`A requirement in ${before.status} cannot be edited`);
    }
    if (areas !== undefined) await replaceAreas(tx, id, areas);
    return await getMyRequirement(tx, actor, id);
  });
}

/** Text fields the public would see, checked for contact details before review. */
function refuseContactDetails(requirement: MyRequirement): void {
  const message = 'Remove phone numbers, emails and links';
  if (findContactDetails(requirement.notes ?? '') !== null) {
    throw new ValidationError(`body/notes ${message}`);
  }
  const texts = Object.values(requirement.preferences).filter((v) => typeof v === 'string');
  if (texts.some((text) => findContactDetails(text) !== null)) {
    throw new ValidationError(`body/preferences ${message}`);
  }
}

/** Sends a draft (or an edited rejected requirement) to staff, with the buyer's consent. */
export async function submitMyRequirement(
  em: Em,
  actor: Actor,
  deps: RequirementDeps,
  id: string,
  body: { consent: boolean },
): Promise<MyRequirement> {
  const buyerId = buyerOf(actor);
  // Before the transaction: staff see this contact in review, and an unlock reads it later.
  const contact = await internalGet<{
    name: string;
    phone: string;
    registeredAs: string;
    status: string;
  }>(deps.identityUrl, `/internal/users/${buyerId}`);
  if (contact.registeredAs !== 'buyer' || contact.status !== 'active') {
    throw new ForbiddenError('Only an active buyer can send a requirement for review');
  }
  return await em.transactional(async (tx) => {
    const before = await getMyRequirement(tx, actor, id);
    if (!body.consent) {
      throw new ValidationError('body/consent Agree to share your contact to send it for review');
    }
    refuseContactDetails(before);
    const moved = await sql<{ id: string }>(
      tx,
      `update requirements set status = 'pending_review', consented_at = now(), submitted_at = now(),
                               updated_at = now()
        where id = ? and buyer_id = ? and deleted_at is null
          and status in (${EDITABLE.map(() => '?').join(', ')})
       returning id`,
      [id, buyerId, ...EDITABLE],
    );
    if (moved[0] === undefined) {
      throw new ConflictError(`A requirement in ${before.status} cannot be sent for review`);
    }
    await sql(
      tx,
      `insert into buyer_contacts (buyer_id, name, phone, updated_at) values (?, ?, ?, now())
       on conflict (buyer_id) do update set name = excluded.name, phone = excluded.phone, updated_at = now()`,
      [buyerId, contact.name, contact.phone],
    );
    await recordTransition(tx, actor, id, before.status, 'pending_review');
    await audit(tx, EXCHANGES.lead, actor, {
      action: 'requirement.submitted',
      targetType: 'requirement',
      targetId: id,
    });
    return await getMyRequirement(tx, actor, id);
  });
}

/** The buyer found what they wanted (or gave up): a live or unpaid requirement ends here. */
export async function closeMyRequirement(em: Em, actor: Actor, id: string): Promise<MyRequirement> {
  const buyerId = buyerOf(actor);
  return await em.transactional(async (tx) => {
    const before = await getMyRequirement(tx, actor, id);
    const closed = await sql<{ id: string }>(
      tx,
      `update requirements set status = 'closed', closed_at = now(), updated_at = now()
        where id = ? and buyer_id = ? and deleted_at is null
          and status in ('live', 'pending_payment')
       returning id`,
      [id, buyerId],
    );
    if (closed[0] === undefined) {
      throw new ConflictError(`A requirement in ${before.status} cannot be closed`);
    }
    await recordTransition(tx, actor, id, before.status, 'closed');
    await audit(tx, EXCHANGES.lead, actor, {
      action: 'requirement.closed',
      targetType: 'requirement',
      targetId: id,
    });
    return await getMyRequirement(tx, actor, id);
  });
}

/** One of the buyer's own requirements; anyone else's is "not found". */
export async function getMyRequirement(em: Em, actor: Actor, id: string): Promise<MyRequirement> {
  const rows = await sql<MyRequirement>(
    em,
    `select ${VIEW} from requirements r where r.id = ? and r.buyer_id = ? and r.deleted_at is null`,
    [id, buyerOf(actor)],
  );
  const row = rows[0];
  if (row === undefined) throw new NotFoundError('Requirement not found');
  return row;
}

/** The buyer's requirements, newest first, 50 a page. */
export async function listMyRequirements(
  em: Em,
  actor: Actor,
  cursor: string | undefined,
): Promise<{ data: MyRequirement[]; nextCursor: string | null }> {
  const [at, lastId] = cursor === undefined ? [null, null] : decodeCursor(cursor);
  const rows = await sql<MyRequirement>(
    em,
    `select ${VIEW} from requirements r
      where r.buyer_id = ? and r.deleted_at is null
        and (?::timestamptz is null or (r.created_at, r.id) < (?::timestamptz, ?::uuid))
      order by r.created_at desc, r.id desc
      limit ${String(PAGE + 1)}`,
    [buyerOf(actor), at, at, lastId],
  );
  const data = rows.slice(0, PAGE);
  const last = data.at(-1);
  return {
    data,
    nextCursor:
      rows.length > PAGE && last !== undefined ? encodeCursor(last.createdAt, last.id) : null,
  };
}
