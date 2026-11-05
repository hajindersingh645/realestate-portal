import { ErrorBody, type App, type Orm } from '@hanu/service-kit';
import { Type } from 'typebox';
import { getUserForService } from './users.service.js';

const Params = Type.Object({ id: Type.String({ format: 'uuid' }) });
const Response = Type.Object({
  id: Type.String(),
  name: Type.String(),
  phone: Type.String(),
  registeredAs: Type.String(),
  status: Type.String(),
});

/** Asked by other services. `public` here; the gateway refuses every `/internal` path. */
export function registerUserInternalRoutes(app: App, deps: { orm: Orm }): void {
  app.get(
    '/internal/users/:id',
    {
      config: { public: true },
      schema: { params: Params, response: { 200: Response, 400: ErrorBody, 404: ErrorBody } },
    },
    async (request) => await getUserForService(deps.orm.em.fork(), request.params.id),
  );
}
