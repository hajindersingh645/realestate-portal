import {
  EXCHANGES,
  REQUIREMENT_STATUSES,
  type RequirementDecision,
  ROUTING_KEYS,
  type RequirementDecisionPayload,
  type RequirementStatus,
} from '@hanu/contracts';
import {
  audit,
  ConflictError,
  decodeCursor,
  encodeCursor,
  getSetting,
  NotFoundError,
  outboxAdd,
  sql,
  ValidationError,
  type Actor,
  type Em,
} from '@hanu/service-kit';
import { recordTransition } from '../requirements/index.js';

/** Which states each staff action may start from. Approve's target depends on the free quota. */
const FROM = new Map<RequirementDecision, readonly RequirementStatus[]>([
  ['approve', ['pending_review']],
  ['reject', ['pending_review']],
  ['hide', ['live']],
  ['fake', ['live', 'hidden']],
]);

interface FreeQuota {
  count: number;
  window: 'lifetime' | 'calendar_month' | 'rolling_30d';
}

const PAGE = 50;
const ISO = `'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'`;

/**
 * Staff decide a requirement. Approve publishes it free while the buyer's quota lasts (counted
 * under a per-buyer lock, fake ones included), otherwise it waits for payment (Phase 4).
 */
export async function decideRequirement(
  em: Em,
  actor: Actor,
  id: string,
  action: RequirementDecision,
  reason: string | undefined,
  timeZone: string,
): Promise<StaffRequirementView> {
  const from = FROM.get(action);
  if (from === undefined) throw new ValidationError('body/action Unknown action');
  const why = action === 'approve' ? null : (reason?.trim() ?? '');
  if (why === '') throw new ValidationError('body/reason A reason is required');
  return await em.transactional(async (tx) => {
    const [row] = await sql<{ buyer_id: string; status: RequirementStatus }>(
      tx,
      'select buyer_id, status from requirements where id = ? and deleted_at is null',
      [id],
    );
    if (row === undefined) throw new NotFoundError('Requirement not found');
    // One approval at a time per buyer, so two requirements cannot both take the last free slot.
    await sql(tx, 'select pg_advisory_xact_lock(hashtext(?::text))', [row.buyer_id]);
    let to: RequirementStatus;
    let free = false;
    if (action === 'approve') {
      const quota = await getSetting<FreeQuota>(tx, 'requirement.freeQuota');
      const [used] = await sql<{ n: number }>(
        tx,
        `select count(*)::int as n from requirements
          where buyer_id = ? and fee_type = 'free' and published_at >= case ?::text
                when 'calendar_month' then date_trunc('month', now() at time zone ?) at time zone ?
                when 'rolling_30d' then now() - interval '30 days'
                else '-infinity'::timestamptz end`,
        [row.buyer_id, quota.window, timeZone, timeZone],
      );
      free = (used?.n ?? 0) < quota.count;
      to = free ? 'live' : 'pending_payment';
    } else {
      to = action === 'reject' ? 'rejected' : action === 'hide' ? 'hidden' : 'fake';
    }
    const days = free ? await getSetting<number>(tx, 'requirement.validityDays') : null;
    const cap = free ? await getSetting<number>(tx, 'lead.maxUnlocks') : null;
    const moved = await sql<{ from_status: RequirementStatus }>(
      tx,
      `update requirements r set status = ?, updated_at = now(),
              fee_type = case when ? then coalesce(r.fee_type, case when ? then 'free' else 'paid' end) else r.fee_type end,
              published_at = case when ? then now() else r.published_at end,
              expires_at = case when ? then now() + make_interval(days => ?::int) else r.expires_at end,
              max_unlocks = case when ? then ?::int else r.max_unlocks end
         from (select id, status from requirements where id = ? for update) old
        where r.id = old.id and old.status in (${from.map(() => '?').join(', ')})
       returning old.status as from_status`,
      [to, action === 'approve', free, free, free, days, free, cap, id, ...from],
    );
    const fromStatus = moved[0]?.from_status;
    if (fromStatus === undefined) {
      throw new ConflictError(`A ${row.status} requirement cannot be given "${action}"`);
    }
    await recordTransition(tx, actor, id, fromStatus, to, why);
    if (action === 'approve' || action === 'reject') {
      const payload: RequirementDecisionPayload = {
        requirementId: id,
        buyerUserId: row.buyer_id,
        status: to as RequirementDecisionPayload['status'],
        reason: why,
      };
      await outboxAdd(tx, {
        exchange: EXCHANGES.lead,
        routingKey:
          action === 'approve'
            ? ROUTING_KEYS.requirementApproved
            : ROUTING_KEYS.requirementRejected,
        producer: actor.service,
        payload,
      });
    }
    await audit(tx, EXCHANGES.lead, actor, {
      action: `requirement.${action}`,
      targetType: 'requirement',
      targetId: id,
      diff: { before: { status: fromStatus }, after: { status: to, reason: why } },
    });
    return await getRequirementForStaff(tx, id);
  });
}

export interface StaffRequirementRow {
  id: string;
  status: RequirementStatus;
  purpose: string;
  propertyTypeId: string;
  cityIds: string[];
  budgetMin: string;
  budgetMax: string;
  buyerName: string | null;
  submittedAt: string | null;
  createdAt: string;
}

export interface StaffRequirementView extends StaffRequirementRow {
  buyerId: string;
  buyerPhone: string | null;
  areas: { locationId: string; cityId: string }[];
  bedrooms: number[];
  areaMin: string | null;
  areaMax: string | null;
  areaUnit: string | null;
  possession: string | null;
  timeline: string | null;
  loanNeeded: boolean | null;
  preferences: Record<string, boolean | string>;
  notes: string | null;
  unlockCount: number;
  maxUnlocks: number | null;
  feeType: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  transitions: {
    fromStatus: string | null;
    toStatus: string;
    reason: string | null;
    actorUserId: string | null;
    createdAt: string;
  }[];
}

const ROW = `r.id, r.status, r.purpose, r.property_type_id as "propertyTypeId",
  array(select distinct l.city_id from requirement_locations l where l.requirement_id = r.id) as "cityIds",
  r.budget_min::text as "budgetMin", r.budget_max::text as "budgetMax", c.name as "buyerName",
  to_char(r.submitted_at at time zone 'UTC', ${ISO}) as "submittedAt",
  to_char(r.created_at at time zone 'UTC', ${ISO}) as "createdAt"`;

/** Everything staff need to judge one requirement, the buyer's contact and its history. */
export async function getRequirementForStaff(em: Em, id: string): Promise<StaffRequirementView> {
  const [row] = await sql<StaffRequirementView>(
    em,
    `select ${ROW}, r.buyer_id as "buyerId", c.phone as "buyerPhone",
            coalesce((select json_agg(json_build_object('locationId', l.location_id, 'cityId', l.city_id)
                                      order by l.location_id)
                        from requirement_locations l where l.requirement_id = r.id), '[]') as areas,
            r.bedrooms, trim_scale(r.area_min)::text as "areaMin", trim_scale(r.area_max)::text as "areaMax",
            r.area_unit as "areaUnit", r.possession, r.timeline, r.loan_needed as "loanNeeded",
            r.preferences, r.notes, r.unlock_count as "unlockCount", r.max_unlocks as "maxUnlocks",
            r.fee_type as "feeType",
            to_char(r.published_at at time zone 'UTC', ${ISO}) as "publishedAt",
            to_char(r.expires_at at time zone 'UTC', ${ISO}) as "expiresAt",
            coalesce((select json_agg(json_build_object(
                               'fromStatus', t.from_state, 'toStatus', t.to_state, 'reason', t.reason,
                               'actorUserId', t.actor_user_id,
                               'createdAt', to_char(t.created_at at time zone 'UTC', ${ISO}))
                             order by t.created_at desc, t.id desc)
                        from state_transitions t
                       where t.entity_type = 'requirement' and t.entity_id = r.id), '[]') as transitions
       from requirements r left join buyer_contacts c on c.buyer_id = r.buyer_id
      where r.id = ? and r.deleted_at is null and r.status <> 'draft'`,
    [id],
  );
  if (row === undefined) throw new NotFoundError('Requirement not found');
  return row;
}

export interface StaffRequirementFilter {
  status?: RequirementStatus;
  q?: string;
  cursor?: string;
}

/** Text search over the note and the buyer's name. Drafts are the buyer's own business. */
function where(q: string | null): { sql: string; params: unknown[] } {
  return {
    sql: `r.deleted_at is null and r.status <> 'draft'
      and (?::text is null or strpos(lower(coalesce(r.notes, '')), ?) > 0
                           or strpos(lower(coalesce(c.name, '')), ?) > 0)`,
    params: [q, q, q],
  };
}

function search(q: string | undefined): string | null {
  const typed = q?.trim().toLowerCase() ?? '';
  return typed === '' ? null : typed;
}

/** Staff queue: newest submitted first, 50 a page. */
export async function listRequirementsForStaff(
  em: Em,
  filter: StaffRequirementFilter,
): Promise<{ data: StaffRequirementRow[]; nextCursor: string | null }> {
  const [at, lastId] = filter.cursor === undefined ? [null, null] : decodeCursor(filter.cursor);
  const w = where(search(filter.q));
  const rows = await sql<StaffRequirementRow>(
    em,
    `select ${ROW} from requirements r left join buyer_contacts c on c.buyer_id = r.buyer_id
      where ${w.sql} and (?::text is null or r.status = ?)
        and (?::timestamptz is null or (r.created_at, r.id) < (?::timestamptz, ?::uuid))
      order by r.created_at desc, r.id desc
      limit ${String(PAGE + 1)}`,
    [...w.params, filter.status ?? null, filter.status ?? null, at, at, lastId],
  );
  const data = rows.slice(0, PAGE);
  const last = data.at(-1);
  return {
    data,
    nextCursor:
      rows.length > PAGE && last !== undefined ? encodeCursor(last.createdAt, last.id) : null,
  };
}

export type StaffRequirementCounts = Record<Exclude<RequirementStatus, 'draft'> | 'all', number>;

/** Per status (drafts left out) and in total, with the same search as the list. */
export async function countRequirementsForStaff(
  em: Em,
  q: string | undefined,
): Promise<StaffRequirementCounts> {
  const w = where(search(q));
  const rows = await sql<{ status: Exclude<RequirementStatus, 'draft'>; n: number }>(
    em,
    `select r.status, count(*)::int as n
       from requirements r left join buyer_contacts c on c.buyer_id = r.buyer_id
      where ${w.sql} group by r.status`,
    w.params,
  );
  const counts = Object.fromEntries(
    [...REQUIREMENT_STATUSES.filter((s) => s !== 'draft'), 'all'].map((k) => [k, 0]),
  ) as StaffRequirementCounts;
  for (const row of rows) {
    counts[row.status] = row.n;
    counts.all += row.n;
  }
  return counts;
}

/** Live requirements past their expiry become `expired`, each with a history row. Safe to rerun. */
export async function expireRequirements(em: Em): Promise<number> {
  const rows = await sql<{ id: string }>(
    em,
    `with moved as (
       update requirements set status = 'expired', updated_at = now()
        where status = 'live' and expires_at <= now()
       returning id)
     insert into state_transitions (id, entity_type, entity_id, from_state, to_state, created_at)
     select gen_random_uuid(), 'requirement', id, 'live', 'expired', now() from moved
     returning entity_id as id`,
  );
  return rows.length;
}

/** `user.contact.changed`: keep the copy current. A user with no requirement has no row. */
export async function updateBuyerContact(
  em: Em,
  payload: { userId: string; name: string; phone: string },
): Promise<void> {
  await sql(
    em,
    'update buyer_contacts set name = ?, phone = ?, updated_at = now() where buyer_id = ?',
    [payload.name, payload.phone, payload.userId],
  );
}
