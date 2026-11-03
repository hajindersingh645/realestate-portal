import { createApp, registerAuth, sql, type App, type Orm } from '@hanu/service-kit';
import type { IdentityConfig } from './load-config.js';

export function buildApp(deps: { orm: Orm; config: IdentityConfig }): App {
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
