import { Type } from 'typebox';

const PermissionKey = Type.String({
  minLength: 3,
  maxLength: 64,
  pattern: '^[a-z_]+(\\.[a-z_]+)+$',
});

export const RoleView = Type.Object({
  id: Type.String(),
  key: Type.String(),
  name: Type.String(),
  isSystem: Type.Boolean(),
  permissions: Type.Array(Type.String()),
});

export const RoleList = Type.Object({ data: Type.Array(RoleView) });

export const CreateRoleBody = Type.Object(
  {
    key: Type.String({ pattern: '^[a-z][a-z0-9_]{1,49}$' }),
    name: Type.String({ minLength: 1, maxLength: 100 }),
    permissions: Type.Array(PermissionKey, { maxItems: 200 }),
  },
  { additionalProperties: false },
);

export const UpdateRoleBody = Type.Object(
  {
    name: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
    /** The full new set, not a change list. */
    permissions: Type.Optional(Type.Array(PermissionKey, { maxItems: 200 })),
  },
  { additionalProperties: false, anyOf: [{ required: ['name'] }, { required: ['permissions'] }] },
);

export const RoleParams = Type.Object({ id: Type.String({ format: 'uuid' }) });
export const UserRoleParams = Type.Object({
  id: Type.String({ format: 'uuid' }),
  roleId: Type.String({ format: 'uuid' }),
});
export const OverrideParams = Type.Object({
  id: Type.String({ format: 'uuid' }),
  permission: PermissionKey,
});

export const OverrideBody = Type.Object(
  {
    effect: Type.Enum(['allow', 'deny'] as const),
    reason: Type.String({ minLength: 3, maxLength: 500 }),
  },
  { additionalProperties: false },
);
