import type { PermissionKey } from '@hanu/contracts';
import { useSession } from './session-store';

/** Whether the signed-in staff member holds `permission`. Re-renders when the token changes. */
export function useCan(permission: PermissionKey): boolean {
  return useSession((state) => state.perms.includes(permission));
}
