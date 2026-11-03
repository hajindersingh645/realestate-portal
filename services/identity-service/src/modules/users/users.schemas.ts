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
