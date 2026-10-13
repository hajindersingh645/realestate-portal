import { NotFoundError, type Orm, type ServiceConfig } from '@hanu/service-kit';
import { createTestKeys, signTestToken } from '@hanu/service-kit/testing';
import { beforeEach, expect, test, vi } from 'vitest';
import { buildApp } from '../../app.js';
import * as service from './demo.service.js';

vi.mock('./demo.service.js');

const keys = createTestKeys();
const config = {
  serviceName: 'catalog-service',
  logLevel: 'silent',
  jwtPublicKey: keys.publicKeyPem,
} as ServiceConfig;
const orm = { em: { fork: () => ({}) } } as unknown as Orm;
const PING_ID = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c01';

beforeEach(() => {
  vi.resetAllMocks();
});

test('POST /demo/pings, with a valid body, returns 202 and the new id', async () => {
  vi.mocked(service.createPing).mockResolvedValue(PING_ID);

  const res = await buildApp({ orm, config }).inject({
    method: 'POST',
    url: '/demo/pings',
    payload: { note: 'hello' },
  });

  expect(res.statusCode).toBe(202);
  expect(res.json()).toEqual({ id: PING_ID });
  expect(service.createPing).toHaveBeenCalledWith(
    expect.anything(),
    { note: 'hello', fail: false },
    'catalog-service',
  );
});

test('POST /demo/pings, without a note, returns 400 and does not call the service', async () => {
  const res = await buildApp({ orm, config }).inject({
    method: 'POST',
    url: '/demo/pings',
    payload: { fail: true },
  });

  expect(res.statusCode).toBe(400);
  expect(service.createPing).not.toHaveBeenCalled();
});

test('GET /demo/pings/:id, when the ping does not exist, returns 404', async () => {
  vi.mocked(service.getPing).mockRejectedValue(new NotFoundError('Ping not found'));

  const res = await buildApp({ orm, config }).inject({
    method: 'GET',
    url: `/demo/pings/${PING_ID}`,
  });

  expect(res.statusCode).toBe(404);
  expect(res.json().error.code).toBe('NOT_FOUND');
});

test('GET /demo/pings/:id, when the ping exists, returns only the declared fields', async () => {
  vi.mocked(service.getPing).mockResolvedValue({
    id: PING_ID,
    note: 'hello',
    receivedAt: undefined,
    createdAt: new Date(),
    deletedAt: undefined,
  });

  const res = await buildApp({ orm, config }).inject({
    method: 'GET',
    url: `/demo/pings/${PING_ID}`,
  });

  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ id: PING_ID, note: 'hello', receivedAt: null });
});

test('GET /demo/whoami, without a token, returns 401', async () => {
  const res = await buildApp({ orm, config }).inject({ method: 'GET', url: '/demo/whoami' });

  expect(res.statusCode).toBe(401);
});

test('GET /demo/whoami, with the catalog permission, returns the caller', async () => {
  const token = await signTestToken(keys.privateKey, {
    sub: 'u1',
    perms: ['admin.catalog.manage'],
  });

  const res = await buildApp({ orm, config }).inject({
    method: 'GET',
    url: '/demo/whoami',
    headers: { authorization: `Bearer ${token}` },
  });

  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ userId: 'u1', perms: ['admin.catalog.manage'] });
});
