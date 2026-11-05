import { ACCOUNT_STATUSES, ACCOUNT_TYPES } from '@hanu/contracts';
import { ErrorBody, UuidListQuery, type App, type Orm } from '@hanu/service-kit';
import { Type } from 'typebox';
import { lookupAccounts } from './accounts.service.js';

const Response = Type.Object({
  data: Type.Array(
    Type.Object({
      id: Type.String(),
      slug: Type.String(),
      displayName: Type.String(),
      type: Type.Unsafe<string>({ type: 'string', enum: [...ACCOUNT_TYPES] }),
      licenseNumber: Type.Union([Type.String(), Type.Null()]),
      status: Type.Unsafe<string>({ type: 'string', enum: [...ACCOUNT_STATUSES] }),
    }),
  ),
});

/** Asked by other services. `public` here; the gateway refuses every `/internal` path. */
export function registerAccountInternalRoutes(app: App, deps: { orm: Orm }): void {
  app.get(
    '/internal/accounts',
    {
      config: { public: true },
      schema: { querystring: UuidListQuery, response: { 200: Response, 400: ErrorBody } },
    },
    async (request) => ({
      data: await lookupAccounts(deps.orm.em.fork(), request.query.ids.split(',')),
    }),
  );
}
