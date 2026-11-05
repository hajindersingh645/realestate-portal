import { ConflictError, NotFoundError, type Orm, type ServiceConfig } from '@hanu/service-kit';
import { createTestKeys, signTestToken } from '@hanu/service-kit/testing';
import { beforeEach, expect, test, vi } from 'vitest';
import { buildApp } from '../../app.js';
import * as service from './property-types.service.js';

vi.mock('./property-types.service.js');

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
const ID = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c02';
const view = {
  id: ID,
  parentId: null,
  slug: 'flat',
  name: 'Flat',
  kind: 'flat',
  isActive: true,
  sort: 1,
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

test('POST /admin/property-types, without a token, returns 401', async () => {
  const res = await buildApp({ orm, config }).inject({
    method: 'POST',
    url: '/admin/property-types',
    payload: { slug: 'flat', name: 'Flat', kind: 'flat' },
  });

  expect(res.statusCode).toBe(401);
});

test('POST /admin/property-types, with a valid body, returns 201 and the new type', async () => {
  vi.mocked(service.createPropertyType).mockResolvedValue(view);

  const res = await buildApp({ orm, config }).inject({
    method: 'POST',
    url: '/admin/property-types',
    headers: await auth(),
    payload: { slug: 'flat', name: 'Flat', kind: 'flat', sort: 1 },
  });

  expect(res.statusCode).toBe(201);
  expect(res.json()).toEqual(view);
  expect(service.createPropertyType).toHaveBeenCalledWith(
    expect.anything(),
    { slug: 'flat', name: 'Flat', kind: 'flat', sort: 1 },
    expect.objectContaining({ service: 'catalog-service' }),
  );
});

test.each([
  ['an unknown kind', { slug: 'villa', name: 'Villa', kind: 'palace' }],
  ['a slug with capitals', { slug: 'Flat', name: 'Flat', kind: 'flat' }],
  [
    'a parentId that is not a UUID',
    { slug: 'shop', name: 'Shop', kind: 'commercial', parentId: 'x' },
  ],
])('POST /admin/property-types, with %s, returns 400', async (_name, payload) => {
  const res = await buildApp({ orm, config }).inject({
    method: 'POST',
    url: '/admin/property-types',
    headers: await auth(),
    payload,
  });

  expect(res.statusCode).toBe(400);
  expect(service.createPropertyType).not.toHaveBeenCalled();
});

test('POST /admin/property-types, when the slug is taken, returns 409', async () => {
  vi.mocked(service.createPropertyType).mockRejectedValue(new ConflictError('Slug taken'));

  const res = await buildApp({ orm, config }).inject({
    method: 'POST',
    url: '/admin/property-types',
    headers: await auth(),
    payload: { slug: 'flat', name: 'Flat', kind: 'flat' },
  });

  expect(res.statusCode).toBe(409);
});

test('PATCH /admin/property-types/:id, with an empty body, returns 400', async () => {
  const res = await buildApp({ orm, config }).inject({
    method: 'PATCH',
    url: `/admin/property-types/${ID}`,
    headers: await auth(),
    payload: {},
  });

  expect(res.statusCode).toBe(400);
});

test('GET /admin/property-types, always, wraps the list in data', async () => {
  vi.mocked(service.listPropertyTypes).mockResolvedValue([view]);

  const res = await buildApp({ orm, config }).inject({
    method: 'GET',
    url: '/admin/property-types',
    headers: await auth(),
  });

  expect(res.json()).toEqual({ data: [view] });
});

test('DELETE /admin/property-types/:id, when the type exists, returns 204', async () => {
  vi.mocked(service.deletePropertyType).mockResolvedValue();

  const res = await buildApp({ orm, config }).inject({
    method: 'DELETE',
    url: `/admin/property-types/${ID}`,
    headers: await auth(),
  });

  expect(res.statusCode).toBe(204);
  expect(service.deletePropertyType).toHaveBeenCalledWith(
    expect.anything(),
    ID,
    expect.objectContaining({ service: 'catalog-service' }),
  );
});

test('DELETE /admin/property-types/:id, when it still has live sub-types, returns 409', async () => {
  vi.mocked(service.deletePropertyType).mockRejectedValue(new ConflictError('Has sub-types'));

  const res = await buildApp({ orm, config }).inject({
    method: 'DELETE',
    url: `/admin/property-types/${ID}`,
    headers: await auth(),
  });

  expect(res.statusCode).toBe(409);
});

test('DELETE /admin/property-types/:id, when the type is unknown, returns 404', async () => {
  vi.mocked(service.deletePropertyType).mockRejectedValue(new NotFoundError('Not found'));

  const res = await buildApp({ orm, config }).inject({
    method: 'DELETE',
    url: `/admin/property-types/${ID}`,
    headers: await auth(),
  });

  expect(res.statusCode).toBe(404);
});

test('DELETE /admin/property-types/:id, when the id is not a UUID, returns 400', async () => {
  const res = await buildApp({ orm, config }).inject({
    method: 'DELETE',
    url: '/admin/property-types/abc',
    headers: await auth(),
  });

  expect(res.statusCode).toBe(400);
  expect(service.deletePropertyType).not.toHaveBeenCalled();
});

test('PATCH /admin/property-types/:id, when only the fixed slug is sent, returns 400', async () => {
  const res = await buildApp({ orm, config }).inject({
    method: 'PATCH',
    url: `/admin/property-types/${ID}`,
    headers: await auth(),
    payload: { slug: 'apartment' },
  });

  expect(res.statusCode).toBe(400);
  expect(service.updatePropertyType).not.toHaveBeenCalled();
});

test('PATCH /admin/property-types/:id, with a name and an unknown key, drops the key and updates', async () => {
  vi.mocked(service.updatePropertyType).mockResolvedValue({ ...view, name: 'Apartment' });

  const res = await buildApp({ orm, config }).inject({
    method: 'PATCH',
    url: `/admin/property-types/${ID}`,
    headers: await auth(),
    payload: { name: 'Apartment', slug: 'apartment' },
  });

  expect(res.statusCode).toBe(200);
  expect(service.updatePropertyType).toHaveBeenCalledWith(
    expect.anything(),
    ID,
    { name: 'Apartment' },
    expect.objectContaining({ service: 'catalog-service' }),
  );
});
