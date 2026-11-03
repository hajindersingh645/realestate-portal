import { ConflictError, NotFoundError, type Orm, type ServiceConfig } from '@hanu/service-kit';
import { createTestKeys, signTestToken } from '@hanu/service-kit/testing';
import { beforeEach, expect, test, vi } from 'vitest';
import { buildApp } from '../../app.js';
import * as service from './lookups.service.js';

vi.mock('./lookups.service.js');

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
const ID = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c01';
const view = {
  id: ID,
  group: 'bhk',
  code: '2_bhk',
  label: '2 BHK',
  meta: null,
  isActive: true,
  sort: 2,
};

async function staffToken(perms = ['admin.catalog.manage']): Promise<string> {
  return await signTestToken(keys.privateKey, { sub: 'u1', perms });
}

beforeEach(() => {
  vi.resetAllMocks();
});

test('POST /admin/lookups, without a token, returns 401', async () => {
  const res = await buildApp({ orm, config }).inject({
    method: 'POST',
    url: '/admin/lookups',
    payload: { group: 'bhk', code: '2_bhk', label: '2 BHK' },
  });

  expect(res.statusCode).toBe(401);
  expect(service.createLookup).not.toHaveBeenCalled();
});

test('POST /admin/lookups, with a token lacking the permission, returns 403', async () => {
  const res = await buildApp({ orm, config }).inject({
    method: 'POST',
    url: '/admin/lookups',
    headers: { authorization: `Bearer ${await staffToken(['lead.unlock'])}` },
    payload: { group: 'bhk', code: '2_bhk', label: '2 BHK' },
  });

  expect(res.statusCode).toBe(403);
});

test('POST /admin/lookups, with a valid body, returns 201 and the new lookup', async () => {
  vi.mocked(service.createLookup).mockResolvedValue(view);

  const res = await buildApp({ orm, config }).inject({
    method: 'POST',
    url: '/admin/lookups',
    headers: { authorization: `Bearer ${await staffToken()}` },
    payload: { group: 'bhk', code: '2_bhk', label: '2 BHK', sort: 2 },
  });

  expect(res.statusCode).toBe(201);
  expect(res.json()).toEqual(view);
  expect(service.createLookup).toHaveBeenCalledWith(
    expect.anything(),
    { group: 'bhk', code: '2_bhk', label: '2 BHK', sort: 2 },
    expect.objectContaining({ service: 'catalog-service' }),
  );
});

test.each([
  ['an unknown group', { group: 'colour', code: 'red', label: 'Red' }],
  ['a code with spaces', { group: 'bhk', code: '2 bhk', label: '2 BHK' }],
  ['no label', { group: 'bhk', code: '2_bhk' }],
])('POST /admin/lookups, with %s, returns 400', async (_name, payload) => {
  const res = await buildApp({ orm, config }).inject({
    method: 'POST',
    url: '/admin/lookups',
    headers: { authorization: `Bearer ${await staffToken()}` },
    payload,
  });

  expect(res.statusCode).toBe(400);
  expect(service.createLookup).not.toHaveBeenCalled();
});

test('POST /admin/lookups, when the lookup already exists, returns 409', async () => {
  vi.mocked(service.createLookup).mockRejectedValue(new ConflictError('Lookup already exists'));

  const res = await buildApp({ orm, config }).inject({
    method: 'POST',
    url: '/admin/lookups',
    headers: { authorization: `Bearer ${await staffToken()}` },
    payload: { group: 'bhk', code: '2_bhk', label: '2 BHK' },
  });

  expect(res.statusCode).toBe(409);
  expect(res.json().error.code).toBe('CONFLICT');
});

test('PATCH /admin/lookups/:id, with an empty body, returns 400', async () => {
  const res = await buildApp({ orm, config }).inject({
    method: 'PATCH',
    url: `/admin/lookups/${ID}`,
    headers: { authorization: `Bearer ${await staffToken()}` },
    payload: {},
  });

  expect(res.statusCode).toBe(400);
});

test('PATCH /admin/lookups/:id, when the id is not a UUID, returns 400', async () => {
  const res = await buildApp({ orm, config }).inject({
    method: 'PATCH',
    url: '/admin/lookups/abc',
    headers: { authorization: `Bearer ${await staffToken()}` },
    payload: { label: 'x' },
  });

  expect(res.statusCode).toBe(400);
});

test('PATCH /admin/lookups/:id, when the lookup does not exist, returns 404', async () => {
  vi.mocked(service.updateLookup).mockRejectedValue(new NotFoundError('Lookup not found'));

  const res = await buildApp({ orm, config }).inject({
    method: 'PATCH',
    url: `/admin/lookups/${ID}`,
    headers: { authorization: `Bearer ${await staffToken()}` },
    payload: { label: 'Two BHK' },
  });

  expect(res.statusCode).toBe(404);
});

test('GET /admin/lookups, with a group filter, passes it to the service and wraps the list', async () => {
  vi.mocked(service.listLookups).mockResolvedValue([view]);

  const res = await buildApp({ orm, config }).inject({
    method: 'GET',
    url: '/admin/lookups?group=bhk',
    headers: { authorization: `Bearer ${await staffToken()}` },
  });

  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ data: [view] });
  expect(service.listLookups).toHaveBeenCalledWith(expect.anything(), { group: 'bhk' });
});

test('DELETE /admin/lookups/:id, when the lookup exists, returns 204 with no body', async () => {
  vi.mocked(service.deleteLookup).mockResolvedValue();

  const res = await buildApp({ orm, config }).inject({
    method: 'DELETE',
    url: `/admin/lookups/${ID}`,
    headers: { authorization: `Bearer ${await staffToken()}` },
  });

  expect(res.statusCode).toBe(204);
  expect(res.body).toBe('');
  expect(service.deleteLookup).toHaveBeenCalledWith(
    expect.anything(),
    ID,
    expect.objectContaining({ service: 'catalog-service' }),
  );
});

test('DELETE /admin/lookups/:id, when the lookup is unknown or already deleted, returns 404', async () => {
  vi.mocked(service.deleteLookup).mockRejectedValue(new NotFoundError('Lookup not found'));

  const res = await buildApp({ orm, config }).inject({
    method: 'DELETE',
    url: `/admin/lookups/${ID}`,
    headers: { authorization: `Bearer ${await staffToken()}` },
  });

  expect(res.statusCode).toBe(404);
});

test('DELETE /admin/lookups/:id, when the id is not a UUID, returns 400', async () => {
  const res = await buildApp({ orm, config }).inject({
    method: 'DELETE',
    url: '/admin/lookups/abc',
    headers: { authorization: `Bearer ${await staffToken()}` },
  });

  expect(res.statusCode).toBe(400);
  expect(service.deleteLookup).not.toHaveBeenCalled();
});

test('PATCH /admin/lookups/:id, when only the fixed code is sent, returns 400', async () => {
  const res = await buildApp({ orm, config }).inject({
    method: 'PATCH',
    url: `/admin/lookups/${ID}`,
    headers: { authorization: `Bearer ${await staffToken()}` },
    payload: { code: '3_bhk' },
  });

  expect(res.statusCode).toBe(400);
  expect(service.updateLookup).not.toHaveBeenCalled();
});
