import { Type } from 'typebox';

export const OtpBody = Type.Object(
  { phone: Type.String({ minLength: 10, maxLength: 20 }) },
  { additionalProperties: false },
);

export const LoginBody = Type.Object(
  {
    phone: Type.String({ minLength: 10, maxLength: 20 }),
    code: Type.String({ pattern: '^[0-9]{6}$' }),
    /** Required, with consent, the first time a number logs in. */
    name: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
    consent: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const UserViewSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  phone: Type.String(),
  email: Type.Union([Type.String(), Type.Null()]),
});

export const TokenResponse = Type.Object({
  accessToken: Type.String(),
  user: UserViewSchema,
});
