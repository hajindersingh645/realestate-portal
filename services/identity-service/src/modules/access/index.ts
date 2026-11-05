export { accessChanged, refuseSelf, SelfChangeError } from './access-changed.js';
export { effectivePermissions } from './effective-permissions.js';
export { grantRole, removeOverride, revokeRole, setOverride } from './grants.service.js';
export { createRole, deleteRole, listRoles, updateRole, type RoleView } from './roles.service.js';
export {
  Permission,
  Role,
  RolePermission,
  UserPermissionOverride,
  UserRole,
} from './access.entities.js';
export { registerAccessRoutes } from './access.routes.js';
