import { ErrorBody, UuidListQuery, type App, type Orm } from '@hanu/service-kit';
import { Type } from 'typebox';
import { lookupPropertyTypes } from './property-types.service.js';

const Response = Type.Object({
  data: Type.Array(
    Type.Object({ id: Type.String(), kind: Type.String(), isActive: Type.Boolean() }),
  ),
});

/** Asked by other services. `public` here; the gateway refuses every `/internal` path. */
export function registerPropertyTypeInternalRoutes(app: App, deps: { orm: Orm }): void {
  app.get(
    '/internal/property-types',
    {
      config: { public: true },
      schema: { querystring: UuidListQuery, response: { 200: Response, 400: ErrorBody } },
    },
    async (request) => ({
      data: await lookupPropertyTypes(deps.orm.em.fork(), request.query.ids.split(',')),
    }),
  );
}
