import type { Orm, ServiceConfig } from '@hanu/service-kit';
import { createTestKeys } from '@hanu/service-kit/testing';
import { beforeEach, expect, test, vi } from 'vitest';
import { buildApp } from '../../app.js';
import * as service from './property-types.service.js';

vi.mock('./property-types.service.js');

const config = {
  serviceName: 'catalog-service',
  logLevel: 'silent',
  jwtPublicKey: createTestKeys().publicKeyPem,
  platform: {
    country: 'IN',
    currency: 'INR',
    locale: 'en-IN',
    timezone: 'Asia/Kolkata',
    areaBaseUnit: 'sqft',
  },
} as ServiceConfig;
const orm = { em: { fork: () => ({}) } } as unknown as Orm;
const A = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c01';
const B = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c02';

beforeEach(() => {
  vi.resetAllMocks();
});

test('GET /internal/property-types, with two ids, passes both and returns what the lookup found', async () => {
  const row = { id: A, kind: 'flat', isActive: true };
  vi.mocked(service.lookupPropertyTypes).mockResolvedValue([row]);

  const res = await buildApp({ orm, config }).inject({
    method: 'GET',
    url: `/internal/property-types?ids=${A},${B}`,
  });

  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ data: [row] });
  expect(vi.mocked(service.lookupPropertyTypes)).toHaveBeenCalledWith(expect.anything(), [A, B]);
});

test('GET /internal/property-types, with an id that is not a UUID, returns 400', async () => {
  const res = await buildApp({ orm, config }).inject({
    method: 'GET',
    url: `/internal/property-types?ids=${A},nope`,
  });

  expect(res.statusCode).toBe(400);
  expect(vi.mocked(service.lookupPropertyTypes)).not.toHaveBeenCalled();
});
