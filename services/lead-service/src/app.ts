import { createApp, registerAuth, sql, type App, type Orm } from '@hanu/service-kit';
import type { LeadConfig } from './load-config.js';
import { registerRequirementRoutes } from './modules/requirements/index.js';

/** Health, readiness and the lead routes, one module at a time. */
export function buildApp(deps: { orm: Orm; config: LeadConfig }): App {
  const app = createApp({
    serviceName: deps.config.serviceName,
    logLevel: deps.config.logLevel,
    readyChecks: [
      async () => {
        await sql(deps.orm.em.fork(), 'select 1');
      },
    ],
  });
  registerAuth(app, { publicKeyPem: deps.config.jwtPublicKey });
  registerRequirementRoutes(app, {
    orm: deps.orm,
    serviceName: deps.config.serviceName,
    requirements: { catalogUrl: deps.config.catalogInternalUrl },
  });
  return app;
}
