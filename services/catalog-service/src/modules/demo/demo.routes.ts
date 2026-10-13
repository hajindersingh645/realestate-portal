import type { App, Orm } from '@hanu/service-kit';
import { UnauthorizedError } from '@hanu/service-kit';
import {
  CreatePingBody,
  ErrorBody,
  PingCreated,
  PingParams,
  PingView,
  WhoAmI,
} from './demo.schemas.js';
import { createPing, getPing } from './demo.service.js';

export function registerDemoRoutes(app: App, deps: { orm: Orm; serviceName: string }): void {
  app.post(
    '/demo/pings',
    {
      config: { public: true },
      schema: { body: CreatePingBody, response: { 202: PingCreated, 400: ErrorBody } },
    },
    async (request, reply) => {
      const id = await createPing(
        deps.orm.em.fork(),
        { note: request.body.note, fail: request.body.fail ?? false },
        deps.serviceName,
      );
      return reply.status(202).send({ id });
    },
  );

  app.get(
    '/demo/pings/:id',
    {
      config: { public: true },
      schema: { params: PingParams, response: { 200: PingView, 404: ErrorBody } },
    },
    async (request) => {
      const ping = await getPing(deps.orm.em.fork(), request.params.id);
      return { id: ping.id, note: ping.note, receivedAt: ping.receivedAt?.toISOString() ?? null };
    },
  );

  app.get(
    '/demo/whoami',
    {
      config: { permission: 'admin.catalog.manage' },
      schema: { response: { 200: WhoAmI, 401: ErrorBody, 403: ErrorBody } },
    },
    (request) => {
      if (request.auth === undefined) throw new UnauthorizedError();
      return { userId: request.auth.userId, perms: request.auth.perms };
    },
  );
}
