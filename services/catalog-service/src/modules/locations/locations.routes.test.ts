import {
  ConflictError,
  NotFoundError,
  ValidationError,
  type Orm,
  type ServiceConfig,
} from '@hanu/service-kit';
import { createTestKeys, signTestToken } from '@hanu/service-kit/testing';
import { beforeEach, expect, test, vi } from 'vitest';
import { buildApp } from '../../app.js';
import * as service from './locations.service.js';

vi.mock('./locations.service.js');

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
const STATE_ID = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c10';
const CITY_ID = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c11';
const city = {
  id: CITY_ID,
  type: 'city',
  parentId: STATE_ID,
  name: 'Zirakpur',
  slug: 'zirakpur',
  code: null,
  lat: 30.64,
  lng: 76.82,
  isActive: true,
  sort: 4,
};

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

test('POST /admin/locations, without a token, returns 401', async () => {
  const res = await buildApp({ orm, config }).inject({
    method: 'POST',
    url: '/admin/locations',
    payload: { type: 'state', name: 'Punjab', slug: 'punjab', code: 'PB' },
  });

  expect(res.statusCode).toBe(401);
});

test('POST /admin/locations, with a valid city, returns 201 and the new location', async () => {
  vi.mocked(service.createLocation).mockResolvedValue(city);

  const res = await buildApp({ orm, config }).inject({
    method: 'POST',
    url: '/admin/locations',
    headers: await auth(),
    payload: {
      type: 'city',
      parentId: STATE_ID,
      name: 'Zirakpur',
      slug: 'zirakpur',
      lat: 30.64,
      lng: 76.82,
    },
  });

  expect(res.statusCode).toBe(201);
  expect(res.json()).toEqual(city);
});

test.each([
  ['an unknown type', { type: 'district', name: 'X', slug: 'x' }],
  ['a slug with spaces', { type: 'state', name: 'Punjab', slug: 'pun jab' }],
  ['a latitude out of range', { type: 'state', name: 'Punjab', slug: 'punjab', lat: 120 }],
  ['a lower-case state code', { type: 'state', name: 'Punjab', slug: 'punjab', code: 'pb' }],
])('POST /admin/locations, with %s, returns 400', async (_name, payload) => {
  const res = await buildApp({ orm, config }).inject({
    method: 'POST',
    url: '/admin/locations',
    headers: await auth(),
    payload,
  });

  expect(res.statusCode).toBe(400);
  expect(service.createLocation).not.toHaveBeenCalled();
});

test('POST /admin/locations, when the parent is the wrong type, returns 400 from the service', async () => {
  vi.mocked(service.createLocation).mockRejectedValue(new ValidationError('Wrong parent'));

  const res = await buildApp({ orm, config }).inject({
    method: 'POST',
    url: '/admin/locations',
    headers: await auth(),
    payload: { type: 'locality', parentId: STATE_ID, name: 'VIP Road', slug: 'vip-road' },
  });

  expect(res.statusCode).toBe(400);
  expect(res.json().error.code).toBe('VALIDATION');
});

test('POST /admin/locations, when the slug is taken, returns 409', async () => {
  vi.mocked(service.createLocation).mockRejectedValue(new ConflictError('Slug taken'));

  const res = await buildApp({ orm, config }).inject({
    method: 'POST',
    url: '/admin/locations',
    headers: await auth(),
    payload: { type: 'city', parentId: STATE_ID, name: 'Zirakpur', slug: 'zirakpur' },
  });

  expect(res.statusCode).toBe(409);
});

test('PATCH /admin/locations/:id, when trying to change the slug, ignores it and needs another field', async () => {
  const res = await buildApp({ orm, config }).inject({
    method: 'PATCH',
    url: `/admin/locations/${CITY_ID}`,
    headers: await auth(),
    payload: { slug: 'new-slug' },
  });

  expect(res.statusCode).toBe(400);
  expect(service.updateLocation).not.toHaveBeenCalled();
});

test('GET /admin/locations, with filters, passes them to the service', async () => {
  vi.mocked(service.listLocations).mockResolvedValue([city]);

  const res = await buildApp({ orm, config }).inject({
    method: 'GET',
    url: `/admin/locations?type=city&parentId=${STATE_ID}`,
    headers: await auth(),
  });

  expect(res.json()).toEqual({ data: [city] });
  expect(service.listLocations).toHaveBeenCalledWith(expect.anything(), {
    type: 'city',
    parentId: STATE_ID,
  });
});

test('DELETE /admin/locations/:id, when the location exists, returns 204', async () => {
  vi.mocked(service.deleteLocation).mockResolvedValue();

  const res = await buildApp({ orm, config }).inject({
    method: 'DELETE',
    url: `/admin/locations/${CITY_ID}`,
    headers: await auth(),
  });

  expect(res.statusCode).toBe(204);
  expect(service.deleteLocation).toHaveBeenCalledWith(
    expect.anything(),
    CITY_ID,
    expect.objectContaining({ service: 'catalog-service' }),
  );
});

test('DELETE /admin/locations/:id, when places still sit under it, returns 409', async () => {
  vi.mocked(service.deleteLocation).mockRejectedValue(new ConflictError('Has children'));

  const res = await buildApp({ orm, config }).inject({
    method: 'DELETE',
    url: `/admin/locations/${STATE_ID}`,
    headers: await auth(),
  });

  expect(res.statusCode).toBe(409);
});

test('DELETE /admin/locations/:id, when the location is unknown, returns 404', async () => {
  vi.mocked(service.deleteLocation).mockRejectedValue(new NotFoundError('Not found'));

  const res = await buildApp({ orm, config }).inject({
    method: 'DELETE',
    url: `/admin/locations/${CITY_ID}`,
    headers: await auth(),
  });

  expect(res.statusCode).toBe(404);
});

test('DELETE /admin/locations/:id, when the id is not a UUID, returns 400', async () => {
  const res = await buildApp({ orm, config }).inject({
    method: 'DELETE',
    url: '/admin/locations/abc',
    headers: await auth(),
  });

  expect(res.statusCode).toBe(400);
  expect(service.deleteLocation).not.toHaveBeenCalled();
});
