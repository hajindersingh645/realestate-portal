import type { Orm } from '@hanu/service-kit';
import { createTestKeys } from '@hanu/service-kit/testing';
import { buildApp } from './app.js';
import type { IdentityConfig } from './load-config.js';

/** An identity app for route tests: test keys, no database (services are mocked). */
export function buildTestApp() {
  const keys = createTestKeys();
  const config = {
    serviceName: 'identity-service',
    logLevel: 'silent',
    jwtPublicKey: keys.publicKeyPem,
    jwtPrivateKey: keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    otpSecret: 'x'.repeat(32),
    adminUrl: 'http://admin.test',
    catalogInternalUrl: 'http://catalog.test',
    platform: {
      country: 'IN',
      currency: 'INR',
      locale: 'en-IN',
      timezone: 'Asia/Kolkata',
      areaBaseUnit: 'sqft',
    },
  } as IdentityConfig;
  const em = { transactional: (fn: (tx: unknown) => unknown) => fn({}) };
  const orm = { em: { fork: () => em } } as unknown as Orm;
  return { app: buildApp({ orm, config }), keys };
}
