import { EXCHANGES } from '@hanu/contracts';
import {
  audit,
  ConflictError,
  NotFoundError,
  sql,
  withDbErrors,
  type Actor,
  type Em,
} from '@hanu/service-kit';
import { randomUUID } from 'node:crypto';
import { accessChanged } from './access-changed.js';

export interface RoleView {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
  permissions: string[];
}

const ROLE_SELECT = `select r.id, r.key, r.name, r.is_system as "isSystem",
    coalesce(array_agg(rp.permission_key order by rp.permission_key)
             filter (where rp.permission_key is not null), '{}') as permissions
  from roles r left join role_permissions rp on rp.role_id = r.id
  where r.deleted_at is null`;

export async function listRoles(em: Em): Promise<RoleView[]> {
  return await sql<RoleView>(em, `${ROLE_SELECT} group by r.id order by r.is_system desc, r.name`);
}

async function findRole(em: Em, id: string): Promise<RoleView | undefined> {
  return (await sql<RoleView>(em, `${ROLE_SELECT} and r.id = ? group by r.id`, [id]))[0];
}

async function setPermissions(
  em: Em,
  roleId: string,
  permissions: readonly string[],
): Promise<void> {
  await sql(em, 'delete from role_permissions where role_id = ?', [roleId]);
  await withDbErrors(
    () =>
      sql(
        em,
        // One comma-joined string: the driver would spread a JS array into separate parameters.
        `insert into role_permissions (role_id, permission_key)
         select ?, unnest(string_to_array(?, ','))`,
        [roleId, [...new Set(permissions)].join(',')],
      ),
    { reference: 'Unknown permission' },
  );
}

async function holders(em: Em, roleId: string): Promise<string[]> {
  const rows = await sql<{ user_id: string }>(
    em,
    'select user_id from user_roles where role_id = ?',
    [roleId],
  );
  return rows.map((row) => row.user_id);
}

export async function createRole(
  em: Em,
  actor: Actor,
  input: { key: string; name: string; permissions: string[] },
): Promise<RoleView> {
  const id = randomUUID();
  return await em.transactional(async (tx) => {
    await withDbErrors(
      () =>
        sql(
          tx,
          `insert into roles (id, key, name, is_system, created_at, updated_at)
           values (?, ?, ?, false, now(), now())`,
          [id, input.key, input.name.trim()],
        ),
      { unique: 'A role with this key exists (deleted keys are not reused)' },
    );
    await setPermissions(tx, id, input.permissions);
    const after = await findRole(tx, id);
    await audit(tx, EXCHANGES.identity, actor, {
      action: 'role.created',
      targetType: 'role',
      targetId: id,
      diff: { after },
    });
    if (after === undefined) throw new NotFoundError('Role not found');
    return after;
  });
}

/** Renames a role and/or replaces its whole permission set. Every holder's access changes. */
export async function updateRole(
  em: Em,
  actor: Actor,
  id: string,
  input: { name?: string; permissions?: string[] },
): Promise<RoleView> {
  return await em.transactional(async (tx) => {
    await sql(tx, 'select id from roles where id = ? for update', [id]);
    const before = await findRole(tx, id);
    if (before === undefined) throw new NotFoundError('Role not found');
    if (input.name !== undefined) {
      await sql(tx, 'update roles set name = ?, updated_at = now() where id = ?', [
        input.name.trim(),
        id,
      ]);
    }
    if (input.permissions !== undefined) await setPermissions(tx, id, input.permissions);
    const after = await findRole(tx, id);
    if (after === undefined) throw new NotFoundError('Role not found');
    await audit(tx, EXCHANGES.identity, actor, {
      action: 'role.updated',
      targetType: 'role',
      targetId: id,
      diff: { before, after },
    });
    if (input.permissions !== undefined)
      await accessChanged(tx, actor.service, await holders(tx, id));
    return after;
  });
}

/** Soft-deletes a staff role; holders lose its permissions. System roles cannot be deleted. */
export async function deleteRole(em: Em, actor: Actor, id: string): Promise<void> {
  await em.transactional(async (tx) => {
    const deleted = await sql(
      tx,
      `update roles set deleted_at = now()
        where id = ? and deleted_at is null and not is_system returning id`,
      [id],
    );
    if (deleted.length === 0) {
      const system = await sql(
        tx,
        'select id from roles where id = ? and deleted_at is null and is_system',
        [id],
      );
      if (system.length > 0) throw new ConflictError('System roles cannot be deleted');
      throw new NotFoundError('Role not found');
    }
    await audit(tx, EXCHANGES.identity, actor, {
      action: 'role.deleted',
      targetType: 'role',
      targetId: id,
    });
    await accessChanged(tx, actor.service, await holders(tx, id));
  });
}
