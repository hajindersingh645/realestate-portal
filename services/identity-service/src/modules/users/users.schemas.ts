import { USER_STATUSES } from '@hanu/contracts';
import { Type } from 'typebox';

export const MeView = Type.Object({
  id: Type.String(),
  name: Type.String(),
  phone: Type.String(),
  email: Type.Union([Type.String(), Type.Null()]),
  registeredAs: Type.String(),
  permissions: Type.Array(Type.String()),
});

// No nested quantifiers: linear-time match. Real verification needs an emailed link (later).
const EMAIL = '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$';

/** `anyOf` makes at least one known field required (see backend-style: PATCH bodies). */
export const UpdateMeBody = Type.Object(
  {
    name: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
    email: Type.Optional(Type.String({ maxLength: 254, pattern: EMAIL })),
  },
  { additionalProperties: false, anyOf: [{ required: ['name'] }, { required: ['email'] }] },
);

export const UserSummaryView = Type.Object({
  id: Type.String(),
  name: Type.String(),
  phone: Type.String(),
  email: Type.Union([Type.String(), Type.Null()]),
  registeredAs: Type.String(),
  status: Type.String(),
  createdAt: Type.String(),
});

export const UserDetailView = Type.Object({
  ...UserSummaryView.properties,
  roles: Type.Array(Type.Object({ id: Type.String(), key: Type.String(), name: Type.String() })),
  overrides: Type.Array(
    Type.Object({ permission: Type.String(), effect: Type.String(), reason: Type.String() }),
  ),
  permissions: Type.Array(Type.String()),
});

export const ListUsersQuery = Type.Object({
  phone: Type.Optional(Type.String({ minLength: 10, maxLength: 20 })),
  status: Type.Optional(Type.Enum(USER_STATUSES)),
});

export const UserParams = Type.Object({ id: Type.String({ format: 'uuid' }) });

export const SetStatusBody = Type.Object(
  { status: Type.Enum(USER_STATUSES), reason: Type.String({ minLength: 3, maxLength: 500 }) },
  { additionalProperties: false },
);
