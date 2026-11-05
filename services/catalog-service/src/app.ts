import {
  createApp,
  registerAuth,
  sql,
  type App,
  type Orm,
  type ServiceConfig,
} from '@hanu/service-kit';
import { registerContentBlockRoutes } from './modules/content-blocks/index.js';
import {
  registerLocationInternalRoutes,
  registerLocationRoutes,
} from './modules/locations/index.js';
import { registerLookupRoutes } from './modules/lookups/index.js';
import {
  registerPropertyTypeInternalRoutes,
  registerPropertyTypeRoutes,
} from './modules/property-types/index.js';
import { registerReferenceRoutes } from './modules/reference/index.js';
import { registerUnitConversionRoutes } from './modules/unit-conversions/index.js';

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
  registerLookupRoutes(app, { orm: deps.orm, serviceName: deps.config.serviceName });
  registerPropertyTypeRoutes(app, { orm: deps.orm, serviceName: deps.config.serviceName });
  registerLocationRoutes(app, { orm: deps.orm, serviceName: deps.config.serviceName });
  registerUnitConversionRoutes(app, { orm: deps.orm, serviceName: deps.config.serviceName });
  registerReferenceRoutes(app, { orm: deps.orm, platform: deps.config.platform });
  registerContentBlockRoutes(app, {
    orm: deps.orm,
    serviceName: deps.config.serviceName,
    platform: deps.config.platform,
  });
  registerLocationInternalRoutes(app, { orm: deps.orm });
  registerPropertyTypeInternalRoutes(app, { orm: deps.orm });
  return app;
}
