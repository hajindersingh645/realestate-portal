import {
  createApp,
  registerAuth,
  sql,
  type App,
  type Orm,
  type ServiceConfig,
} from '@hanu/service-kit';

/** Health and readiness only: this service is driven by events. Admin routes come with the panel. */
export function buildApp(deps: { orm: Orm; config: ServiceConfig }): App {
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
