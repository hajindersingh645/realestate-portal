import { EXCHANGES } from '@hanu/contracts';
import {
  AppError,
  audit,
  ConflictError,
  decodeCursor,
  encodeCursor,
  ForbiddenError,
  getSetting,
  internalGet,
  NotFoundError,
  sql,
  uuidv7,
  type Actor,
  type Em,
} from '@hanu/service-kit';
import { findContactDetails } from '../requirements/index.js';

const PAGE = 50;
const ISO = `'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'`;
const LIVE = `r.status = 'live' and r.expires_at > now() and r.deleted_at is null`;

/** What anyone may see: every detail of the need and the buyer's name, never a way to reach them. */
const PUBLIC = `r.id, c.name as "buyerName", r.purpose, r.property_type_id as "propertyTypeId",
  coalesce((select json_agg(json_build_object('locationId', l.location_id, 'cityId', l.city_id)
                            order by l.location_id)
              from requirement_locations l where l.requirement_id = r.id), '[]') as areas,
  r.budget_min::text as "budgetMin", r.budget_max::text as "budgetMax", r.bedrooms,
  trim_scale(r.area_min)::text as "areaMin", trim_scale(r.area_max)::text as "areaMax",
  r.area_unit as "areaUnit", r.possession, r.timeline, r.loan_needed as "loanNeeded",
  r.preferences, r.notes,
  to_char(r.published_at at time zone 'UTC', ${ISO}) as "publishedAt",
  to_char(r.expires_at at time zone 'UTC', ${ISO}) as "expiresAt",
  r.unlock_count as "unlockCount", r.max_unlocks as "maxUnlocks"`;

export interface PublicRequirement {
  id: string;
  buyerName: string;
  purpose: string;
  propertyTypeId: string;
  areas: { locationId: string; cityId: string }[];
  budgetMin: string;
  budgetMax: string;
  bedrooms: number[];
  areaMin: string | null;
  areaMax: string | null;
  areaUnit: string | null;
  possession: string | null;
  timeline: string | null;
  loanNeeded: boolean | null;
  preferences: Record<string, boolean | string>;
  notes: string | null;
  publishedAt: string;
  expiresAt: string;
  unlockCount: number;
  maxUnlocks: number;
}

/** A name that itself carries a number or link is shown as "Buyer". */
function masked<T extends { buyerName: string | null }>(row: T): T & { buyerName: string } {
  const name = row.buyerName ?? '';
  return { ...row, buyerName: name === '' || findContactDetails(name) !== null ? 'Buyer' : name };
}

export interface PublicFilter {
  cityId?: string;
  locationId?: string;
  propertyTypeId?: string;
  purpose?: string;
  cursor?: string;
}

/** Live requirements for the public site, newest first, 50 a page. */
export async function listPublicRequirements(
  em: Em,
  filter: PublicFilter,
): Promise<{ data: PublicRequirement[]; nextCursor: string | null }> {
  const [at, lastId] = filter.cursor === undefined ? [null, null] : decodeCursor(filter.cursor);
  const rows = await sql<PublicRequirement & { cursorAt: string }>(
    em,
    `select ${PUBLIC}, to_char(r.published_at at time zone 'UTC', ${ISO}) as "cursorAt"
       from requirements r left join buyer_contacts c on c.buyer_id = r.buyer_id
      where ${LIVE}
        and (?::uuid is null or exists (select 1 from requirement_locations l
                                         where l.requirement_id = r.id and l.city_id = ?::uuid))
        and (?::uuid is null or exists (select 1 from requirement_locations l
                                         where l.requirement_id = r.id and l.location_id = ?::uuid))
        and (?::uuid is null or r.property_type_id = ?::uuid)
        and (?::text is null or r.purpose = ?)
        and (?::timestamptz is null or (r.published_at, r.id) < (?::timestamptz, ?::uuid))
      order by r.published_at desc, r.id desc
      limit ${String(PAGE + 1)}`,
    [
      filter.cityId ?? null,
      filter.cityId ?? null,
      filter.locationId ?? null,
      filter.locationId ?? null,
      filter.propertyTypeId ?? null,
      filter.propertyTypeId ?? null,
      filter.purpose ?? null,
      filter.purpose ?? null,
      at,
      at,
      lastId,
    ],
  );
  const data = rows.slice(0, PAGE).map(masked);
  const last = data.at(-1);
  return {
    data, // `cursorAt` is dropped by the route's response schema
    nextCursor:
      rows.length > PAGE && last !== undefined ? encodeCursor(last.cursorAt, last.id) : null,
  };
}

export async function getPublicRequirement(em: Em, id: string): Promise<PublicRequirement> {
  const [row] = await sql<PublicRequirement>(
    em,
    `select ${PUBLIC} from requirements r left join buyer_contacts c on c.buyer_id = r.buyer_id
      where r.id = ? and ${LIVE}`,
    [id],
  );
  if (row === undefined) throw new NotFoundError('Requirement not found');
  return masked(row);
}

export interface MyLead extends PublicRequirement {
  unlockId: string;
  unlockedAt: string;
  buyer: { name: string; phone: string };
}

export interface LeadCaller {
  userId: string;
  accountId?: string;
  accountStatus?: string;
}

/** 409 with its own code so the dashboard can say "full" or "plans open soon". */
class LeadError extends AppError {
  constructor(code: string, message: string) {
    super(code, message, 409);
  }
}

/**
 * "I'm interested": an approved professional account takes the buyer's contact. A second click
 * returns the same unlock; the cap is the `where` of one update, so a 6th never gets in.
 */
export async function unlockRequirement(
  em: Em,
  caller: LeadCaller,
  actor: Actor,
  id: string,
): Promise<MyLead> {
  const accountId = caller.accountId;
  if (accountId === undefined || caller.accountStatus !== 'approved') {
    throw new ForbiddenError('Only an approved professional account can unlock a lead');
  }
  return await em.transactional(async (tx) => {
    const [existing] = await sql<{ id: string }>(
      tx,
      'select id from lead_unlocks where requirement_id = ? and account_id = ?',
      [id, accountId],
    );
    if (existing === undefined) {
      // PHASE 4: delete this free path and the `lead.unlock.free` setting; charge instead.
      if (!(await getSetting<boolean>(tx, 'lead.unlock.free'))) {
        throw new LeadError('UNLOCKS_UNAVAILABLE', 'Plans open soon');
      }
      const [taken] = await sql<{ id: string }>(
        tx,
        `update requirements r set unlock_count = unlock_count + 1, updated_at = now()
          where r.id = ? and ${LIVE} and unlock_count < max_unlocks
         returning id`,
        [id],
      );
      if (taken === undefined) {
        const [live] = await sql(tx, `select 1 from requirements r where r.id = ? and ${LIVE}`, [
          id,
        ]);
        if (live === undefined) throw new NotFoundError('Requirement not found');
        throw new LeadError('LEAD_FULL', 'This lead is full');
      }
      await sql(
        tx,
        `insert into lead_unlocks (id, requirement_id, account_id, user_id, status, charge_source, unlocked_at)
         values (?, ?, ?, ?, 'active', 'free', now())`,
        [uuidv7(), id, accountId, caller.userId],
      );
      await audit(tx, EXCHANGES.lead, actor, {
        action: 'lead.unlocked',
        targetType: 'requirement',
        targetId: id,
      });
    }
    const [lead] = (await myLeads(tx, accountId, null, id)).data;
    if (lead === undefined) throw new ConflictError('Unlock could not be read back');
    return lead;
  });
}

async function myLeads(
  em: Em,
  accountId: string,
  cursor: string | null,
  onlyId: string | null = null,
): Promise<{ data: MyLead[]; nextCursor: string | null }> {
  const [at, lastId] = cursor === null ? [null, null] : decodeCursor(cursor);
  const rows = await sql<MyLead & { cursorAt: string }>(
    em,
    `select ${PUBLIC}, u.id as "unlockId",
            to_char(u.unlocked_at at time zone 'UTC', ${ISO}) as "unlockedAt",
            to_char(u.unlocked_at at time zone 'UTC', ${ISO}) as "cursorAt",
            json_build_object('name', c.name, 'phone', c.phone) as buyer
       from lead_unlocks u
       join requirements r on r.id = u.requirement_id
       left join buyer_contacts c on c.buyer_id = r.buyer_id
      where u.account_id = ? and u.status = 'active'
        and (?::uuid is null or r.id = ?::uuid)
        and (?::timestamptz is null or (u.unlocked_at, u.id) < (?::timestamptz, ?::uuid))
      order by u.unlocked_at desc, u.id desc
      limit ${String(PAGE + 1)}`,
    [accountId, onlyId, onlyId, at, at, lastId],
  );
  const data = rows.slice(0, PAGE);
  const last = data.at(-1);
  return {
    data,
    nextCursor:
      rows.length > PAGE && last !== undefined ? encodeCursor(last.cursorAt, last.unlockId) : null,
  };
}

/** My Leads: what this account unlocked, with the buyer's name and phone. */
export async function listMyLeads(
  em: Em,
  caller: LeadCaller,
  cursor: string | undefined,
): Promise<{ data: MyLead[]; nextCursor: string | null }> {
  if (caller.accountId === undefined) return { data: [], nextCursor: null };
  return await myLeads(em, caller.accountId, cursor ?? null);
}

export interface UnlockedBy {
  accountId: string;
  unlockedAt: string;
  slug: string | null;
  displayName: string | null;
  type: string | null;
  licenseNumber: string | null;
}

/** The buyer's "Unlocked by": who took their contact. Names come from identity when it answers. */
export async function listUnlocksForBuyer(
  em: Em,
  buyerId: string,
  id: string,
  identityUrl: string,
): Promise<{ data: UnlockedBy[]; namesUnavailable: boolean }> {
  const [own] = await sql(
    em,
    'select 1 from requirements where id = ? and buyer_id = ? and deleted_at is null',
    [id, buyerId],
  );
  if (own === undefined) throw new NotFoundError('Requirement not found');
  const rows = await sql<{ accountId: string; unlockedAt: string }>(
    em,
    `select account_id as "accountId", to_char(unlocked_at at time zone 'UTC', ${ISO}) as "unlockedAt"
       from lead_unlocks where requirement_id = ? and status = 'active' order by unlocked_at`,
    [id],
  );
  if (rows.length === 0) return { data: [], namesUnavailable: false };
  const blank = { slug: null, displayName: null, type: null, licenseNumber: null };
  try {
    const { data } = await internalGet<{
      data: {
        id: string;
        slug: string;
        displayName: string;
        type: string;
        licenseNumber: string | null;
      }[];
    }>(identityUrl, `/internal/accounts?ids=${rows.map((r) => r.accountId).join(',')}`);
    const found = new Map(data.map((a) => [a.id, a]));
    return {
      data: rows.map((r) => {
        const a = found.get(r.accountId);
        return a === undefined
          ? { ...r, ...blank }
          : {
              ...r,
              slug: a.slug,
              displayName: a.displayName,
              type: a.type,
              licenseNumber: a.licenseNumber,
            };
      }),
      namesUnavailable: false,
    };
  } catch {
    return { data: rows.map((r) => ({ ...r, ...blank })), namesUnavailable: true };
  }
}
