import {
  EXCHANGES,
  ROUTING_KEYS,
  type AccountDecision,
  type AccountDecisionPayload,
  type AccountStatus,
  type AccountType,
} from '@hanu/contracts';
import {
  audit,
  ConflictError,
  decodeCursor,
  encodeCursor,
  NotFoundError,
  outboxAdd,
  sql,
  uuidv7,
  ValidationError,
  type Actor,
  type Em,
} from '@hanu/service-kit';
import { accessChanged } from '../access/index.js';
import type { Area } from './accounts.service.js';

interface Move {
  from: readonly AccountStatus[];
  to: AccountStatus;
  routingKey: string;
}

/** The only moves staff can make. Anything else is a 409, decided in the `update … where`. */
const MOVES = new Map<AccountDecision, Move>([
  ['approve', { from: ['pending'], to: 'approved', routingKey: ROUTING_KEYS.accountApproved }],
  ['reject', { from: ['pending'], to: 'rejected', routingKey: ROUTING_KEYS.accountRejected }],
  ['suspend', { from: ['approved'], to: 'suspended', routingKey: ROUTING_KEYS.accountSuspended }],
  [
    'ban',
    {
      from: ['pending', 'approved', 'rejected', 'suspended'],
      to: 'banned',
      routingKey: ROUTING_KEYS.accountSuspended, // consumers read `status: 'banned'`
    },
  ],
  ['reactivate', { from: ['suspended'], to: 'approved', routingKey: ROUTING_KEYS.accountApproved }],
]);

export interface Transition {
  fromStatus: AccountStatus | null;
  toStatus: AccountStatus;
  reason: string | null;
  actorUserId: string | null;
  actorName: string | null;
  createdAt: string;
}

export interface StaffAccountView {
  id: string;
  type: AccountType;
  displayName: string;
  slug: string;
  about: string | null;
  experienceYears: number | null;
  specialisations: string[];
  licenseNumber: string | null;
  status: AccountStatus;
  createdAt: string;
  owner: { userId: string; name: string; phone: string; email: string | null };
  areas: Area[];
  /** Newest first. */
  transitions: Transition[];
}

export interface StaffAccountRow {
  id: string;
  type: AccountType;
  displayName: string;
  slug: string;
  status: AccountStatus;
  createdAt: string;
  owner: { userId: string; name: string; phone: string };
}

export interface StaffAccountFilter {
  status?: AccountStatus;
  type?: AccountType;
  /** Part of the display name or slug, any case. */
  q?: string;
  cursor?: string;
}

const PAGE = 50;
const ISO = `'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'`;
const OWNER_JOIN = `join account_members m on m.account_id = a.id and m.member_role = 'owner' and m.status = 'active'
                    join users u on u.id = m.user_id`;

/**
 * One staff decision. The status check and the change are one `update`, and the row is locked
 * first, so of two decisions at once the second sees the new status and gets a 409.
 */
export async function decideAccount(
  em: Em,
  actor: Actor,
  accountId: string,
  action: AccountDecision,
  reason: string | undefined,
): Promise<StaffAccountView> {
  const move = MOVES.get(action);
  if (move === undefined) throw new ValidationError('body/action Unknown action');
  const why = action === 'approve' ? null : (reason?.trim() ?? '');
  if (why === '') throw new ValidationError('body/reason A reason is required');
  return await em.transactional(async (tx) => {
    const moved = await sql<{ from_status: AccountStatus; owner_id: string }>(
      tx,
      `update accounts a set status = ?, updated_at = now()
         from (select id, status from accounts where id = ? and deleted_at is null for update) old,
              account_members m
        where a.id = old.id and m.account_id = a.id and m.member_role = 'owner' and m.status = 'active'
          and old.status in (${move.from.map(() => '?').join(', ')})
       returning old.status as from_status, m.user_id as owner_id`,
      [move.to, accountId, ...move.from],
    );
    const row = moved[0];
    if (row === undefined) {
      const now = await sql<{ status: AccountStatus }>(
        tx,
        'select status from accounts where id = ? and deleted_at is null',
        [accountId],
      );
      const current = now[0]?.status;
      if (current === undefined) throw new NotFoundError('Account not found');
      throw new ConflictError(`A ${current} account cannot be given "${action}"`);
    }
    await sql(
      tx,
      `insert into account_transitions (id, account_id, from_status, to_status, reason, actor_user_id, created_at)
       values (?, ?, ?, ?, ?, ?, now())`,
      [uuidv7(), accountId, row.from_status, move.to, why, actor.userId],
    );
    const payload: AccountDecisionPayload = {
      accountId,
      ownerUserId: row.owner_id,
      status: move.to,
      reason: why,
    };
    await outboxAdd(tx, {
      exchange: EXCHANGES.identity,
      routingKey: move.routingKey,
      producer: actor.service,
      payload,
    });
    await audit(tx, EXCHANGES.identity, actor, {
      action: `account.${action}`,
      targetType: 'account',
      targetId: accountId,
      diff: { before: { status: row.from_status }, after: { status: move.to, reason: why } },
    });
    // The owner's token carries `accSt`; tokens issued before now are refused.
    await accessChanged(tx, actor.service, [row.owner_id]);
    return await getAccountForStaff(tx, accountId);
  });
}

interface DetailRow extends Omit<StaffAccountView, 'transitions'> {
  transitions: Transition[];
}

export async function getAccountForStaff(em: Em, accountId: string): Promise<StaffAccountView> {
  const rows = await sql<DetailRow>(
    em,
    `select a.id, a.type, a.display_name as "displayName", a.slug, a.about,
            a.experience_years as "experienceYears", a.specialisations,
            a.license_number as "licenseNumber", a.status,
            to_char(a.created_at at time zone 'UTC', ${ISO}) as "createdAt",
            json_build_object('userId', u.id, 'name', u.name, 'phone', u.phone, 'email', u.email) as owner,
            coalesce((select json_agg(json_build_object('locationId', l.location_id, 'cityId', l.city_id)
                                      order by l.location_id)
                        from account_locations l where l.account_id = a.id), '[]') as areas,
            coalesce((select json_agg(json_build_object(
                               'fromStatus', t.from_status, 'toStatus', t.to_status, 'reason', t.reason,
                               'actorUserId', t.actor_user_id, 'actorName', au.name,
                               'createdAt', to_char(t.created_at at time zone 'UTC', ${ISO}))
                             order by t.created_at desc, t.id desc)
                        from account_transitions t left join users au on au.id = t.actor_user_id
                       where t.account_id = a.id), '[]') as transitions
       from accounts a ${OWNER_JOIN}
      where a.id = ? and a.deleted_at is null`,
    [accountId],
  );
  const row = rows[0];
  if (row === undefined) throw new NotFoundError('Account not found');
  return row;
}

/** Newest first, 50 per page, keyset paging on (created_at, id). */
export async function listAccountsForStaff(
  em: Em,
  filter: StaffAccountFilter,
): Promise<{ data: StaffAccountRow[]; nextCursor: string | null }> {
  const [at, id] = filter.cursor === undefined ? [null, null] : decodeCursor(filter.cursor);
  const typed = filter.q?.trim().toLowerCase() ?? '';
  const q = typed === '' ? null : typed;
  const rows = await sql<StaffAccountRow>(
    em,
    `select a.id, a.type, a.display_name as "displayName", a.slug, a.status,
            to_char(a.created_at at time zone 'UTC', ${ISO}) as "createdAt",
            json_build_object('userId', u.id, 'name', u.name, 'phone', u.phone) as owner
       from accounts a ${OWNER_JOIN}
      where a.deleted_at is null
        and (?::text is null or a.status = ?)
        and (?::text is null or a.type = ?)
        and (?::text is null or strpos(lower(a.display_name), ?) > 0 or strpos(a.slug, ?) > 0)
        and (?::timestamptz is null or (a.created_at, a.id) < (?::timestamptz, ?::uuid))
      order by a.created_at desc, a.id desc
      limit ${String(PAGE + 1)}`,
    [
      filter.status ?? null,
      filter.status ?? null,
      filter.type ?? null,
      filter.type ?? null,
      q,
      q,
      q,
      at,
      at,
      id,
    ],
  );
  const data = rows.slice(0, PAGE);
  const last = data.at(-1);
  return {
    data,
    nextCursor:
      rows.length > PAGE && last !== undefined ? encodeCursor(last.createdAt, last.id) : null,
  };
}
