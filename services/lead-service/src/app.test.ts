import type { Orm } from '@hanu/service-kit';
import { createTestKeys } from '@hanu/service-kit/testing';
import { expect, test } from 'vitest';
import { buildApp } from './app.js';
import type { LeadConfig } from './load-config.js';

const config = {
  serviceName: 'lead-service',
  logLevel: 'silent',
  jwtPublicKey: createTestKeys().publicKeyPem,
  identityInternalUrl: 'http://identity.test',
  catalogInternalUrl: 'http://catalog.test',
} as LeadConfig;
const orm = { em: { fork: () => ({}) } } as unknown as Orm;

test('GET /health, without a token, returns 200', async () => {
  const res = await buildApp({ orm, config }).inject({ method: 'GET', url: '/health' });

  expect(res.statusCode).toBe(200);
});
