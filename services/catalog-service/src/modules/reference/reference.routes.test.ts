import type { Orm, ServiceConfig } from '@hanu/service-kit';
import { createTestKeys } from '@hanu/service-kit/testing';
import { beforeEach, expect, test, vi } from 'vitest';
import { buildApp } from '../../app.js';
import * as service from './reference.service.js';

vi.mock('./reference.service.js');

const platform = {
  country: 'IN',
  currency: 'INR',
  locale: 'en-IN',
  timezone: 'Asia/Kolkata',
  areaBaseUnit: 'sqft',
};
const config = {
  serviceName: 'catalog-service',
  logLevel: 'silent',
  jwtPublicKey: createTestKeys().publicKeyPem,
  platform,
} as ServiceConfig;
const orm = { em: { fork: () => ({}) } } as unknown as Orm;

beforeEach(() => {
  vi.resetAllMocks();
});

test('GET /reference, without a token, returns the reference data', async () => {
  const data = {
    platform,
    locations: [],
    propertyTypes: [],
    lookups: [
      {
        id: 'a',
        group: 'bhk',
        code: '2_bhk',
        label: '2 BHK',
        meta: null,
        isActive: true,
        sort: 2,
      },
    ],
    unitConversions: [],
  };
  vi.mocked(service.getReference).mockResolvedValue(data);

  const res = await buildApp({ orm, config }).inject({ method: 'GET', url: '/reference' });

  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual(data);
  expect(service.getReference).toHaveBeenCalledWith(expect.anything(), platform);
});

test('GET /reference, when the service returns a field the schema does not declare, strips it', async () => {
  vi.mocked(service.getReference).mockResolvedValue({
    platform,
    locations: [],
    propertyTypes: [],
    lookups: [],
    unitConversions: [],
    internalNote: 'do not leak',
  } as never);

  const res = await buildApp({ orm, config }).inject({ method: 'GET', url: '/reference' });

  expect(res.body).not.toContain('internalNote');
});
