import { ErrorBody, UnauthorizedError, type App, type Orm } from '@hanu/service-kit';
import type { FastifyRequest } from 'fastify';
import { MeView, UpdateMeBody } from './users.schemas.js';
import { getMe, updateMe } from './users.service.js';

function userIdOf(request: FastifyRequest): string {
  if (request.auth === undefined) throw new UnauthorizedError();
  return request.auth.userId;
}

export function registerUserRoutes(app: App, deps: { orm: Orm; serviceName: string }): void {
  app.get(
    '/users/me',
    {
      config: { authenticated: true },
      schema: { response: { 200: MeView, 401: ErrorBody, 404: ErrorBody } },
    },
    async (request) => await getMe(deps.orm.em.fork(), userIdOf(request)),
  );

  app.patch(
    '/users/me',
    {
      config: { authenticated: true },
      schema: {
        body: UpdateMeBody,
        response: { 200: MeView, 400: ErrorBody, 401: ErrorBody, 404: ErrorBody, 409: ErrorBody },
      },
    },
    async (request) =>
      await updateMe(deps.orm.em.fork(), deps.serviceName, userIdOf(request), request.body),
  );
}
