import cookie from '@fastify/cookie';
import { createApp, registerAuth, sql, type App, type Orm } from '@hanu/service-kit';
import type { IdentityConfig } from './load-config.js';
import { registerAccessRoutes } from './modules/access/index.js';
import { registerAccountRoutes } from './modules/accounts/index.js';
import { registerAuditLogRoutes } from './modules/audit-logs/index.js';
import { registerAuthRoutes } from './modules/auth/index.js';
import { registerStaffAuthRoutes } from './modules/staff-auth/index.js';
import { registerStaffSetupRoutes } from './modules/staff-setup/index.js';
import { registerAdminUserRoutes, registerUserRoutes } from './modules/users/index.js';
import { loadSigningKey } from './tokens.js';

export function buildApp(deps: { orm: Orm; config: IdentityConfig }): App {
  const { config, orm } = deps;
  const app = createApp({
    serviceName: config.serviceName,
    logLevel: config.logLevel,
    readyChecks: [
      async () => {
        await sql(orm.em.fork(), 'select 1');
      },
    ],
  });
  void app.register(cookie);
  registerAuth(app, { publicKeyPem: config.jwtPublicKey });
  const auth = {
    otp: {
      otpSecret: config.otpSecret,
      locale: config.platform.locale,
      producer: config.serviceName,
    },
    signingKey: loadSigningKey(config.jwtPrivateKey),
    country: config.platform.country,
    serviceName: config.serviceName,
  };
  registerAuthRoutes(app, { orm, auth });
  registerStaffAuthRoutes(app, { orm, auth });
  registerStaffSetupRoutes(app, {
    orm,
    serviceName: config.serviceName,
    setup: { country: config.platform.country, adminUrl: config.adminUrl },
  });
  registerUserRoutes(app, { orm, serviceName: config.serviceName });
  registerAccessRoutes(app, { orm, serviceName: config.serviceName });
  registerAuditLogRoutes(app, { orm });
  registerAccountRoutes(app, {
    orm,
    serviceName: config.serviceName,
    accounts: { catalogUrl: config.catalogInternalUrl },
  });
  registerAdminUserRoutes(app, {
    orm,
    serviceName: config.serviceName,
    country: config.platform.country,
  });
  return app;
}
