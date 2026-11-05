import { createApp, registerAuth, sql, type App, type Orm } from '@hanu/service-kit';
import type { LeadConfig } from './load-config.js';

/** Health and readiness now; requirement, moderation and lead routes are added per module. */
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
  return app;
}
