import type { Orm } from '@hanu/service-kit';
import { createTestKeys, signTestToken } from '@hanu/service-kit/testing';
import { buildApp } from '../app.js';
import type { LeadConfig } from '../load-config.js';

/** A lead app for route tests: test keys, no database (services are mocked). */
export async function testApp(perms: string[] = [], claims: Record<string, unknown> = {}) {
  const keys = createTestKeys();
  const config = {
    serviceName: 'lead-service',
    logLevel: 'silent',
    jwtPublicKey: keys.publicKeyPem,
    identityInternalUrl: 'http://identity.test',
    catalogInternalUrl: 'http://catalog.test',
    platform: {
      country: 'IN',
      currency: 'INR',
      locale: 'en-IN',
      timezone: 'Asia/Kolkata',
      areaBaseUnit: 'sqft',
    },
  } as LeadConfig;
  const em = { transactional: (fn: (tx: unknown) => unknown) => fn({}) };
  const orm = { em: { fork: () => em } } as unknown as Orm;
  const token = await signTestToken(keys.privateKey, { sub: 'u1', perms, ...claims });
  return { app: buildApp({ orm, config }), headers: { authorization: `Bearer ${token}` } };
}
