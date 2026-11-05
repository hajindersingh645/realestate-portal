import { ErrorBody, type App, type Orm } from '@hanu/service-kit';
import {
  ProfessionalList,
  ProfessionalQuery,
  PublicProfessional,
  SlugParams,
} from './accounts.schemas.js';
import { getProfessional, listProfessionals } from './professionals.service.js';

/** Read-only directory for the public site. Approved accounts only (see `LIVE`). */
export function registerProfessionalRoutes(app: App, deps: { orm: Orm }): void {
  app.get(
    '/professionals',
    {
      config: { public: true },
      schema: {
        querystring: ProfessionalQuery,
        response: { 200: ProfessionalList, 400: ErrorBody },
      },
    },
    async (request) => await listProfessionals(deps.orm.em.fork(), request.query),
  );

  app.get(
    '/professionals/:slug',
    {
      config: { public: true },
      schema: { params: SlugParams, response: { 200: PublicProfessional, 404: ErrorBody } },
    },
    async (request) => await getProfessional(deps.orm.em.fork(), request.params.slug),
  );
}
