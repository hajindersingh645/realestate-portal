import { EXCHANGES, type UserStatus } from '@hanu/contracts';
import { audit, NotFoundError, sql, uuidv7, type Actor, type Em } from '@hanu/service-kit';
import { accessChanged, effectivePermissions, refuseSelf } from '../access/index.js';

export interface UserSummary {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  registeredAs: string;
  status: string;
  createdAt: string;
}

export interface UserDetail extends UserSummary {
  roles: { id: string; key: string; name: string }[];
  overrides: { permission: string; effect: string; reason: string }[];
  permissions: string[];
}

const SUMMARY = `id, name, phone, email, registered_as as "registeredAs", status,
  to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "createdAt"`;

/** Newest first, at most 50. `phone` must already be normalised (E.164). */
export async function listUsers(
  em: Em,
  filter: { phone?: string; status?: UserStatus },
): Promise<UserSummary[]> {
  return await sql<UserSummary>(
    em,
    `select ${SUMMARY} from users
      where deleted_at is null and (?::text is null or phone = ?) and (?::text is null or status = ?)
      order by created_at desc, id limit 50`,
    [filter.phone ?? null, filter.phone ?? null, filter.status ?? null, filter.status ?? null],
  );
}

export async function getUserDetail(em: Em, id: string): Promise<UserDetail> {
  const user = (
    await sql<UserSummary>(em, `select ${SUMMARY} from users where id = ? and deleted_at is null`, [
      id,
    ])
  )[0];
  if (user === undefined) throw new NotFoundError('User not found');
  const roles = await sql<{ id: string; key: string; name: string }>(
    em,
    `select r.id, r.key, r.name from user_roles ur join roles r on r.id = ur.role_id
      where ur.user_id = ? and r.deleted_at is null order by r.name`,
    [id],
  );
  const overrides = await sql<{ permission: string; effect: string; reason: string }>(
    em,
    `select permission_key as permission, effect, reason from user_permission_overrides
      where user_id = ? order by permission_key`,
    [id],
  );
  return { ...user, roles, overrides, permissions: await effectivePermissions(em, id) };
}

/**
 * Suspends, bans or reactivates a user. Leaving `active` revokes every session in the same
 * transaction, and the gateway refuses their current access token once the event arrives.
 */
export async function setUserStatus(
  em: Em,
  actor: Actor,
  id: string,
  input: { status: UserStatus; reason: string },
): Promise<UserDetail> {
  refuseSelf(actor.userId, id);
  await em.transactional(async (tx) => {
    const changed = await sql<{ from_status: string }>(
      tx,
      `with old as (select status from users where id = ? and deleted_at is null for update)
       update users u set status = ?, updated_at = now() from old
        where u.id = ? and old.status <> ?
       returning old.status as from_status`,
      [id, input.status, id, input.status],
    );
    const row = changed[0];
    if (row === undefined) {
      const exists = await sql(tx, 'select 1 from users where id = ? and deleted_at is null', [id]);
      if (exists.length === 0) throw new NotFoundError('User not found');
      return; // already in that status
    }
    if (input.status !== 'active') {
      await sql(
        tx,
        'update sessions set revoked_at = now() where user_id = ? and revoked_at is null',
        [id],
      );
    }
    await sql(
      tx,
      `insert into state_transitions (id, entity_type, entity_id, from_state, to_state, actor_user_id, reason, created_at)
       values (?, 'user', ?, ?, ?, ?, ?, now())`,
      [uuidv7(), id, row.from_status, input.status, actor.userId, input.reason.trim()],
    );
    await audit(tx, EXCHANGES.identity, actor, {
      action: 'user.status.changed',
      targetType: 'user',
      targetId: id,
      diff: {
        before: { status: row.from_status },
        after: { status: input.status, reason: input.reason.trim() },
      },
    });
    await accessChanged(tx, actor.service, [id]);
  });
  return await getUserDetail(em, id);
}
