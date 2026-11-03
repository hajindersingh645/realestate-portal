import type { App, Orm, ServiceConfig } from '@hanu/service-kit';
import { ReferenceResponse } from './reference.schemas.js';
import { getReference } from './reference.service.js';

export function registerReferenceRoutes(
  app: App,
  deps: { orm: Orm; platform: ServiceConfig['platform'] },
): void {
  app.get(
    '/reference',
    { config: { public: true }, schema: { response: { 200: ReferenceResponse } } },
    async () => await getReference(deps.orm.em.fork(), deps.platform),
  );
}
