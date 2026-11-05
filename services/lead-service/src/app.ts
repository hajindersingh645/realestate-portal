import { createApp, registerAuth, sql, type App, type Orm } from '@hanu/service-kit';
import type { LeadConfig } from './load-config.js';
import { registerLeadRoutes } from './modules/leads/index.js';
import { registerModerationRoutes } from './modules/moderation/index.js';
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
    requirements: {
      catalogUrl: deps.config.catalogInternalUrl,
      identityUrl: deps.config.identityInternalUrl,
    },
  });
  registerLeadRoutes(app, {
    orm: deps.orm,
    serviceName: deps.config.serviceName,
    identityUrl: deps.config.identityInternalUrl,
  });
  registerModerationRoutes(app, {
    orm: deps.orm,
    serviceName: deps.config.serviceName,
    timeZone: deps.config.platform.timezone,
  });
  return app;
}
