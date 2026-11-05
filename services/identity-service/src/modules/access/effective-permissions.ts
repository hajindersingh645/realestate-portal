import { sql, type Em } from '@hanu/service-kit';

/**
 * What the user may do: (permissions of their live roles ∪ allow overrides) − deny overrides.
 * One query; the result goes into the access token.
 */
export async function effectivePermissions(em: Em, userId: string): Promise<string[]> {
  const rows = await sql<{ key: string }>(
    em,
    `select key from (
       select rp.permission_key as key
         from user_roles ur
         join roles r on r.id = ur.role_id and r.deleted_at is null
         join role_permissions rp on rp.role_id = r.id
        where ur.user_id = ?
       union
       select permission_key from user_permission_overrides where user_id = ? and effect = 'allow'
     ) granted
     where key not in (
       select permission_key from user_permission_overrides where user_id = ? and effect = 'deny'
     )
     order by key`,
    [userId, userId, userId],
  );
  return rows.map((row) => row.key);
}
