import { PERMISSIONS } from '@hanu/contracts';
import { sql, type Em } from '@hanu/service-kit';

/**
 * Makes the `permissions` table match `PERMISSIONS` in contracts and gives `super_admin` every
 * key. Runs after each `pnpm migrate`. Inserts only: a key removed from code stays in the table
 * until a migration removes it, because roles and overrides may still point at it.
 */
export async function syncPermissions(em: Em): Promise<{ added: number; granted: number }> {
  const added = await sql(
    em,
    // One comma-joined string: the driver would spread a JS array into separate parameters.
    `insert into permissions (key) select unnest(string_to_array(?, ','))
     on conflict do nothing returning key`,
    [PERMISSIONS.join(',')],
  );
  const granted = await sql(
    em,
    `insert into role_permissions (role_id, permission_key)
     select r.id, p.key from roles r cross join permissions p where r.key = 'super_admin'
     on conflict do nothing returning permission_key`,
  );
  return { added: added.length, granted: granted.length };
}
