import { actorOf, ErrorBody, UnauthorizedError, type App, type Orm } from '@hanu/service-kit';
import { CreateAccountBody, MyAccountView, UpdateAccountBody } from './accounts.schemas.js';
import {
  createAccount,
  getMyAccount,
  resubmitMyAccount,
  updateMyAccount,
  type AccountDeps,
} from './accounts.service.js';

/** The owner's side of a professional account. Ownership comes from the token, never the URL. */
export function registerAccountRoutes(
  app: App,
  deps: { orm: Orm; serviceName: string; accounts: AccountDeps },
): void {
  app.get(
    '/accounts/me',
    {
      config: { authenticated: true },
      schema: { response: { 200: MyAccountView, 401: ErrorBody, 404: ErrorBody } },
    },
    async (request) => {
      if (request.auth === undefined) throw new UnauthorizedError();
      return await getMyAccount(deps.orm.em.fork(), request.auth.userId);
    },
  );

  // Any signed-in user may create one: no role grants this yet (the role comes from the account).
  app.post(
    '/accounts/me',
    {
      config: { authenticated: true },
      schema: {
        body: CreateAccountBody,
        response: {
          201: MyAccountView,
          400: ErrorBody,
          401: ErrorBody,
          403: ErrorBody,
          409: ErrorBody,
          503: ErrorBody,
        },
      },
    },
    async (request, reply) => {
      const account = await createAccount(
        deps.orm.em.fork(),
        actorOf(request, deps.serviceName),
        deps.accounts,
        request.body,
      );
      return await reply.status(201).send(account);
    },
  );

  app.patch(
    '/accounts/me',
    {
      config: { permission: 'profile.manage' },
      schema: {
        body: UpdateAccountBody,
        response: {
          200: MyAccountView,
          400: ErrorBody,
          401: ErrorBody,
          403: ErrorBody,
          404: ErrorBody,
          409: ErrorBody,
          503: ErrorBody,
        },
      },
    },
    async (request) =>
      await updateMyAccount(
        deps.orm.em.fork(),
        actorOf(request, deps.serviceName),
        deps.accounts,
        request.body,
      ),
  );

  app.post(
    '/accounts/me/resubmit',
    {
      config: { permission: 'profile.manage' },
      schema: {
        response: {
          200: MyAccountView,
          401: ErrorBody,
          403: ErrorBody,
          404: ErrorBody,
          409: ErrorBody,
        },
      },
    },
    async (request) =>
      await resubmitMyAccount(deps.orm.em.fork(), actorOf(request, deps.serviceName)),
  );
}
