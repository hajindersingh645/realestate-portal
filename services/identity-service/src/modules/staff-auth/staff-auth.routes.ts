import { ErrorBody, type App, type Orm } from '@hanu/service-kit';
import { Type } from 'typebox';
import { clientOf, InvalidOtpError, sendTokens, type AuthDeps } from '../auth/index.js';
import { TokenResponse } from '../auth/auth.schemas.js';
import { startStaffLogin, verifyStaffLogin } from './staff-auth.service.js';

const StaffLoginBody = Type.Object(
  {
    email: Type.String({ minLength: 3, maxLength: 254 }),
    password: Type.String({ minLength: 1, maxLength: 200 }),
  },
  { additionalProperties: false },
);

const StaffVerifyBody = Type.Object(
  { challengeId: Type.String({ format: 'uuid' }), code: Type.String({ pattern: '^[0-9]{6}$' }) },
  { additionalProperties: false },
);

export function registerStaffAuthRoutes(app: App, deps: { orm: Orm; auth: AuthDeps }): void {
  app.post(
    '/auth/staff/login',
    {
      config: { public: true },
      schema: {
        body: StaffLoginBody,
        response: {
          202: Type.Object({ challengeId: Type.String() }),
          400: ErrorBody,
          401: ErrorBody,
          429: ErrorBody,
        },
      },
    },
    async (request, reply) => {
      const result = await startStaffLogin(deps.orm.em.fork(), deps.auth, request.body);
      return reply.status(202).send(result);
    },
  );

  app.post(
    '/auth/staff/verify',
    {
      config: { public: true },
      schema: {
        body: StaffVerifyBody,
        response: { 200: TokenResponse, 400: ErrorBody, 401: ErrorBody, 403: ErrorBody },
      },
    },
    async (request, reply) => {
      const result = await verifyStaffLogin(
        deps.orm.em.fork(),
        deps.auth,
        request.body,
        clientOf(request),
      );
      if (!result.ok) throw new InvalidOtpError();
      return sendTokens(reply, result.tokens);
    },
  );
}
