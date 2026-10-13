import { Type } from 'typebox';

export const CreatePingBody = Type.Object({
  note: Type.String({ minLength: 1, maxLength: 200 }),
  fail: Type.Optional(Type.Boolean()),
});

export const PingParams = Type.Object({ id: Type.String({ format: 'uuid' }) });

export const PingCreated = Type.Object({ id: Type.String() });

export const PingView = Type.Object({
  id: Type.String(),
  note: Type.String(),
  receivedAt: Type.Union([Type.String(), Type.Null()]),
});

export const WhoAmI = Type.Object({ userId: Type.String(), perms: Type.Array(Type.String()) });

export const ErrorBody = Type.Object({
  error: Type.Object({ code: Type.String(), message: Type.String() }),
});
