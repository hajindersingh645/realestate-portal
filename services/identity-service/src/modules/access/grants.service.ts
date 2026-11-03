import { EXCHANGES } from '@hanu/contracts';
import { audit, NotFoundError, sql, withDbErrors, type Actor, type Em } from '@hanu/service-kit';
import { accessChanged, refuseSelf } from './access-changed.js';

/** Gives a user a role. Granting a role they already hold changes nothing. */
export async function grantRole(
  em: Em,
  actor: Actor,
  userId: string,
  roleId: string,
): Promise<void> {
  refuseSelf(actor.userId, userId);
  await em.transactional(async (tx) => {
    const granted = await sql<{ key: string }>(
      tx,
      `insert into user_roles (user_id, role_id, granted_by, granted_at)
       select u.id, r.id, ?, now() from users u, roles r
        where u.id = ? and u.deleted_at is null and r.id = ? and r.deleted_at is null
       on conflict do nothing
       returning (select key from roles where id = role_id) as key`,
      [actor.userId, userId, roleId],
    );
    const role = granted[0];
    if (role === undefined) {
      const held = await sql(tx, 'select 1 from user_roles where user_id = ? and role_id = ?', [
        userId,
        roleId,
      ]);
      if (held.length > 0) return;
      throw new NotFoundError('User or role not found');
    }
    await audit(tx, EXCHANGES.identity, actor, {
      action: 'user.role.granted',
      targetType: 'user',
      targetId: userId,
      diff: { after: { role: role.key } },
    });
    await accessChanged(tx, actor.service, [userId]);
  });
}

export async function revokeRole(
  em: Em,
  actor: Actor,
  userId: string,
  roleId: string,
): Promise<void> {
  refuseSelf(actor.userId, userId);
  await em.transactional(async (tx) => {
    const revoked = await sql<{ key: string }>(
      tx,
      `delete from user_roles where user_id = ? and role_id = ?
       returning (select key from roles where id = role_id) as key`,
      [userId, roleId],
    );
    const role = revoked[0];
    if (role === undefined) throw new NotFoundError('The user does not hold this role');
    await audit(tx, EXCHANGES.identity, actor, {
      action: 'user.role.revoked',
      targetType: 'user',
      targetId: userId,
      diff: { before: { role: role.key } },
    });
    await accessChanged(tx, actor.service, [userId]);
  });
}

interface OverrideRow {
  effect: string;
  reason: string;
}

/** Sets (or replaces) an allow/deny exception for one permission on one user. */
export async function setOverride(
  em: Em,
  actor: Actor,
  userId: string,
  permission: string,
  input: { effect: 'allow' | 'deny'; reason: string },
): Promise<void> {
  refuseSelf(actor.userId, userId);
  await em.transactional(async (tx) => {
    const before = await sql<OverrideRow>(
      tx,
      'select effect, reason from user_permission_overrides where user_id = ? and permission_key = ? for update',
      [userId, permission],
    );
    await withDbErrors(
      () =>
        sql(
          tx,
          `insert into user_permission_overrides (user_id, permission_key, effect, reason, created_by, created_at)
           select id, ?, ?, ?, ?, now() from users where id = ? and deleted_at is null
           on conflict (user_id, permission_key)
           do update set effect = excluded.effect, reason = excluded.reason,
                         created_by = excluded.created_by, created_at = excluded.created_at`,
          [permission, input.effect, input.reason.trim(), actor.userId, userId],
        ),
      { reference: 'Unknown permission', check: 'A reason is required' },
    );
    const exists = await sql(tx, 'select 1 from users where id = ? and deleted_at is null', [
      userId,
    ]);
    if (exists.length === 0) throw new NotFoundError('User not found');
    await audit(tx, EXCHANGES.identity, actor, {
      action: 'user.override.set',
      targetType: 'user',
      targetId: userId,
      diff: {
        before: before[0] ? { permission, ...before[0] } : undefined,
        after: { permission, ...input },
      },
    });
    await accessChanged(tx, actor.service, [userId]);
  });
}

export async function removeOverride(
  em: Em,
  actor: Actor,
  userId: string,
  permission: string,
): Promise<void> {
  refuseSelf(actor.userId, userId);
  await em.transactional(async (tx) => {
    const removed = await sql<OverrideRow>(
      tx,
      `delete from user_permission_overrides where user_id = ? and permission_key = ?
       returning effect, reason`,
      [userId, permission],
    );
    const before = removed[0];
    if (before === undefined) throw new NotFoundError('No override for this permission');
    await audit(tx, EXCHANGES.identity, actor, {
      action: 'user.override.removed',
      targetType: 'user',
      targetId: userId,
      diff: { before: { permission, ...before } },
    });
    await accessChanged(tx, actor.service, [userId]);
  });
}
