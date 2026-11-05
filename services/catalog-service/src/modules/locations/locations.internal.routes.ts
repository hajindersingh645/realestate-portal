import { ErrorBody, type App, type Orm } from '@hanu/service-kit';
import { Type } from 'typebox';
import { lookupLocations } from './locations.service.js';

const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';

const Query = Type.Object({
  // Comma-separated UUIDs, at most 100. The pattern has no nested quantifiers (no backtracking risk).
  ids: Type.String({ pattern: `^${UUID}(,${UUID}){0,99}$` }),
});

const Response = Type.Object({
  data: Type.Array(
    Type.Object({
      id: Type.String(),
      type: Type.String(),
      cityId: Type.Union([Type.String(), Type.Null()]),
      isActive: Type.Boolean(),
    }),
  ),
});

/**
 * Asked by other services (identity checks "areas served"). `public` at the service; the gateway
 * refuses every path with an `internal` segment, so it is reachable only inside the network.
 */
export function registerLocationInternalRoutes(app: App, deps: { orm: Orm }): void {
  app.get(
    '/internal/locations',
    {
      config: { public: true },
      schema: { querystring: Query, response: { 200: Response, 400: ErrorBody } },
    },
    async (request) => ({
      data: await lookupLocations(deps.orm.em.fork(), request.query.ids.split(',')),
    }),
  );
}
