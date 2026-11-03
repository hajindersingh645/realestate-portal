import { ErrorBody, type App, type Orm } from '@hanu/service-kit';
import { Type } from 'typebox';
import { actorOf } from '../../actor.js';
import { phoneOrThrow } from '../auth/index.js';
import { getUserDetail, listUsers, setUserStatus } from './admin-users.service.js';
import {
  ListUsersQuery,
  SetStatusBody,
  UserDetailView,
  UserParams,
  UserSummaryView,
} from './users.schemas.js';

const config = { permission: 'admin.user.manage' };
const errors = { 400: ErrorBody, 401: ErrorBody, 403: ErrorBody, 404: ErrorBody, 409: ErrorBody };

export function registerAdminUserRoutes(
  app: App,
  deps: { orm: Orm; serviceName: string; country: string },
): void {
  app.get(
    '/admin/identity/users',
    {
      config,
      schema: {
        querystring: ListUsersQuery,
        response: { 200: Type.Object({ data: Type.Array(UserSummaryView) }), ...errors },
      },
    },
    async (request) => {
      const { phone, status } = request.query;
      return {
        data: await listUsers(deps.orm.em.fork(), {
          ...(phone === undefined ? {} : { phone: phoneOrThrow(phone, deps.country) }),
          ...(status === undefined ? {} : { status }),
        }),
      };
    },
  );

  app.get(
    '/admin/identity/users/:id',
    { config, schema: { params: UserParams, response: { 200: UserDetailView, ...errors } } },
    async (request) => await getUserDetail(deps.orm.em.fork(), request.params.id),
  );

  app.post(
    '/admin/identity/users/:id/status',
    {
      config,
      schema: {
        params: UserParams,
        body: SetStatusBody,
        response: { 200: UserDetailView, ...errors },
      },
    },
    async (request) =>
      await setUserStatus(
        deps.orm.em.fork(),
        actorOf(request, deps.serviceName),
        request.params.id,
        request.body,
      ),
  );
}
