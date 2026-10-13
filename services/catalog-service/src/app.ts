import {
  createApp,
  registerAuth,
  sql,
  type App,
  type Orm,
  type ServiceConfig,
} from '@hanu/service-kit';
import { registerDemoRoutes } from './modules/demo/index.js';

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
  registerDemoRoutes(app, { orm: deps.orm, serviceName: deps.config.serviceName });
  return app;
}
