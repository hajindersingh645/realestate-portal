import { ConflictError, NotFoundError, type Orm, type ServiceConfig } from '@hanu/service-kit';
import { createTestKeys, signTestToken } from '@hanu/service-kit/testing';
import { beforeEach, expect, test, vi } from 'vitest';
import { buildApp } from '../../app.js';
import * as service from './unit-conversions.service.js';

vi.mock('./unit-conversions.service.js');

const keys = createTestKeys();
const config = {
  serviceName: 'catalog-service',
  logLevel: 'silent',
  jwtPublicKey: keys.publicKeyPem,
  platform: {
    country: 'IN',
    currency: 'INR',
    locale: 'en-IN',
    timezone: 'Asia/Kolkata',
    areaBaseUnit: 'sqft',
  },
} as ServiceConfig;
const orm = { em: { fork: () => ({}) } } as unknown as Orm;
const ID = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c20';
const UNIT_ID = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c21';
const view = { id: ID, unitId: UNIT_ID, locationId: null, factor: 225 };

async function auth(): Promise<{ authorization: string }> {
  const token = await signTestToken(keys.privateKey, {
    sub: 'u1',
    perms: ['admin.catalog.manage'],
  });
  return { authorization: `Bearer ${token}` };
}

beforeEach(() => {
  vi.resetAllMocks();
});

test('POST /admin/unit-conversions, without a token, returns 401', async () => {
  const res = await buildApp({ orm, config }).inject({
    method: 'POST',
    url: '/admin/unit-conversions',
    payload: { unitId: UNIT_ID, factor: 225 },
  });

  expect(res.statusCode).toBe(401);
});

test('POST /admin/unit-conversions, with a valid body, returns 201', async () => {
  vi.mocked(service.createUnitConversion).mockResolvedValue(view);

  const res = await buildApp({ orm, config }).inject({
    method: 'POST',
    url: '/admin/unit-conversions',
    headers: await auth(),
    payload: { unitId: UNIT_ID, factor: 225 },
  });

  expect(res.statusCode).toBe(201);
  expect(res.json()).toEqual(view);
});

test.each([
  ['zero', 0],
  ['a negative number', -9],
  ['a string that is not a number', 'big'],
])('POST /admin/unit-conversions, with a factor of %s, returns 400', async (_name, factor) => {
  const res = await buildApp({ orm, config }).inject({
    method: 'POST',
    url: '/admin/unit-conversions',
    headers: await auth(),
    payload: { unitId: UNIT_ID, factor },
  });

  expect(res.statusCode).toBe(400);
  expect(service.createUnitConversion).not.toHaveBeenCalled();
});

test('POST /admin/unit-conversions, when that unit and city already have a factor, returns 409', async () => {
  vi.mocked(service.createUnitConversion).mockRejectedValue(new ConflictError('Exists'));

  const res = await buildApp({ orm, config }).inject({
    method: 'POST',
    url: '/admin/unit-conversions',
    headers: await auth(),
    payload: { unitId: UNIT_ID, factor: 225 },
  });

  expect(res.statusCode).toBe(409);
});

test('PATCH /admin/unit-conversions/:id, without a factor, returns 400', async () => {
  const res = await buildApp({ orm, config }).inject({
    method: 'PATCH',
    url: `/admin/unit-conversions/${ID}`,
    headers: await auth(),
    payload: {},
  });

  expect(res.statusCode).toBe(400);
});

test('DELETE /admin/unit-conversions/:id, when the conversion exists, returns 204', async () => {
  vi.mocked(service.deleteUnitConversion).mockResolvedValue();

  const res = await buildApp({ orm, config }).inject({
    method: 'DELETE',
    url: `/admin/unit-conversions/${ID}`,
    headers: await auth(),
  });

  expect(res.statusCode).toBe(204);
  expect(service.deleteUnitConversion).toHaveBeenCalledWith(
    expect.anything(),
    ID,
    'catalog-service',
  );
});

test('DELETE /admin/unit-conversions/:id, when the conversion is unknown, returns 404', async () => {
  vi.mocked(service.deleteUnitConversion).mockRejectedValue(new NotFoundError('Not found'));

  const res = await buildApp({ orm, config }).inject({
    method: 'DELETE',
    url: `/admin/unit-conversions/${ID}`,
    headers: await auth(),
  });

  expect(res.statusCode).toBe(404);
});

test('DELETE /admin/unit-conversions/:id, when the id is not a UUID, returns 400', async () => {
  const res = await buildApp({ orm, config }).inject({
    method: 'DELETE',
    url: '/admin/unit-conversions/abc',
    headers: await auth(),
  });

  expect(res.statusCode).toBe(400);
  expect(service.deleteUnitConversion).not.toHaveBeenCalled();
});
