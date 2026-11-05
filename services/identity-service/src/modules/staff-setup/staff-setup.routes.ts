import { actorOf, ErrorBody, type App, type Orm } from '@hanu/service-kit';
import { Type } from 'typebox';
import { MIN_PASSWORD_LENGTH } from '../staff-auth/index.js';
import {
  completeSetup,
  createStaff,
  issueSetupLink,
  type StaffSetupDeps,
} from './staff-setup.service.js';

const CreateStaffBody = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 100 }),
    email: Type.String({ format: 'email', maxLength: 254 }),
    phone: Type.String({ minLength: 10, maxLength: 20 }),
    roleIds: Type.Array(Type.String({ format: 'uuid' }), {
      minItems: 1,
      maxItems: 20,
      uniqueItems: true,
    }),
  },
  { additionalProperties: false },
);
const SetupLinkView = Type.Object({ setupUrl: Type.String(), expiresAt: Type.String() });
const CreatedStaffView = Type.Object({
  userId: Type.String(),
  setupUrl: Type.String(),
  expiresAt: Type.String(),
});
const StaffParams = Type.Object({ id: Type.String({ format: 'uuid' }) });
const SetupBody = Type.Object(
  {
    token: Type.String({ minLength: 20, maxLength: 100 }),
    password: Type.String({ minLength: MIN_PASSWORD_LENGTH, maxLength: 200 }),
  },
  { additionalProperties: false },
);

const config = { permission: 'admin.access.manage' };
const errors = { 400: ErrorBody, 401: ErrorBody, 403: ErrorBody, 404: ErrorBody, 409: ErrorBody };

export function registerStaffSetupRoutes(
  app: App,
  deps: { orm: Orm; serviceName: string; setup: StaffSetupDeps },
): void {
  app.post(
    '/admin/identity/staff',
    { config, schema: { body: CreateStaffBody, response: { 201: CreatedStaffView, ...errors } } },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          await createStaff(
            deps.orm.em.fork(),
            actorOf(request, deps.serviceName),
            deps.setup,
            request.body,
          ),
        ),
  );

  app.post(
    '/admin/identity/staff/:id/setup-link',
    { config, schema: { params: StaffParams, response: { 201: SetupLinkView, ...errors } } },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          await issueSetupLink(
            deps.orm.em.fork(),
            actorOf(request, deps.serviceName),
            deps.setup,
            request.params.id,
          ),
        ),
  );

  app.post(
    '/auth/staff/setup',
    {
      config: { public: true },
      schema: { body: SetupBody, response: { 204: Type.Null(), 400: ErrorBody } },
    },
    async (request, reply) => {
      await completeSetup(
        deps.orm.em.fork(),
        // Public route: nobody is signed in yet. The service fills in the user once the link resolves.
        { service: deps.serviceName, userId: null, ip: request.ip },
        request.body.token,
        request.body.password,
      );
      return reply.status(204).send(null);
    },
  );
}
