import { actorOf, ErrorBody, type App, type Orm } from '@hanu/service-kit';
import {
  AccountIdParams,
  DecisionBody,
  StaffAccountCountQuery,
  StaffAccountCounts,
  StaffAccountList,
  StaffAccountQuery,
  StaffAccountView,
} from './accounts.schemas.js';
import {
  countAccountsForStaff,
  decideAccount,
  getAccountForStaff,
  listAccountsForStaff,
} from './account-review.service.js';

/** Staff approvals. Every route needs `admin.account.review`. */
export function registerAccountReviewRoutes(
  app: App,
  deps: { orm: Orm; serviceName: string },
): void {
  const config = { permission: 'admin.account.review' };
  const denied = { 401: ErrorBody, 403: ErrorBody };

  app.get(
    '/admin/identity/accounts',
    {
      config,
      schema: {
        querystring: StaffAccountQuery,
        response: { 200: StaffAccountList, 400: ErrorBody, ...denied },
      },
    },
    async (request) => await listAccountsForStaff(deps.orm.em.fork(), request.query),
  );

  // A fixed path, so Fastify matches it before `/:id`.
  app.get(
    '/admin/identity/accounts/counts',
    {
      config,
      schema: {
        querystring: StaffAccountCountQuery,
        response: { 200: StaffAccountCounts, 400: ErrorBody, ...denied },
      },
    },
    async (request) => await countAccountsForStaff(deps.orm.em.fork(), request.query),
  );

  app.get(
    '/admin/identity/accounts/:id',
    {
      config,
      schema: {
        params: AccountIdParams,
        response: { 200: StaffAccountView, 400: ErrorBody, 404: ErrorBody, ...denied },
      },
    },
    async (request) => await getAccountForStaff(deps.orm.em.fork(), request.params.id),
  );

  app.post(
    '/admin/identity/accounts/:id/decision',
    {
      config,
      schema: {
        params: AccountIdParams,
        body: DecisionBody,
        response: {
          200: StaffAccountView,
          400: ErrorBody,
          404: ErrorBody,
          409: ErrorBody,
          ...denied,
        },
      },
    },
    async (request) =>
      await decideAccount(
        deps.orm.em.fork(),
        actorOf(request, deps.serviceName),
        request.params.id,
        request.body.action,
        request.body.reason,
      ),
  );
}
