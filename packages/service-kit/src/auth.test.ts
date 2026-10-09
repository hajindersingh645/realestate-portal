import { Type } from 'typebox';
import { expect, test } from 'vitest';
import { createApp } from './app.js';
import { registerAuth } from './auth.js';
import { createTestKeys, signTestToken } from './testing.js';

const keys = createTestKeys();

function build() {
  const app = createApp({ serviceName: 'test', logLevel: 'silent' });
  registerAuth(app, { publicKeyPem: keys.publicKeyPem });
  app.get('/open', { config: { public: true } }, () => ({ ok: true }));
  app.get('/guarded', { config: { permission: 'lead.unlock' } }, (request) => ({
    userId: request.auth?.userId,
    accountId: request.auth?.accountId,
  }));
  return app;
}

test('a public route, without a token, is served', async () => {
  const res = await build().inject({ method: 'GET', url: '/open' });

  expect(res.statusCode).toBe(200);
});

test('a guarded route, without a token, returns 401', async () => {
  const res = await build().inject({ method: 'GET', url: '/guarded' });

  expect(res.statusCode).toBe(401);
  expect(res.json().error.code).toBe('UNAUTHORIZED');
});

test('a guarded route, with a valid token lacking the permission, returns 403', async () => {
  const token = await signTestToken(keys.privateKey, { sub: 'u1', perms: ['listing.create'] });

  const res = await build().inject({
    method: 'GET',
    url: '/guarded',
    headers: { authorization: `Bearer ${token}` },
  });

  expect(res.statusCode).toBe(403);
});

test('a guarded route, with a valid token holding the permission, exposes request.auth', async () => {
  const token = await signTestToken(keys.privateKey, {
    sub: 'u1',
    acc: 'a1',
    perms: ['lead.unlock'],
  });

  const res = await build().inject({
    method: 'GET',
    url: '/guarded',
    headers: { authorization: `Bearer ${token}` },
  });

  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ userId: 'u1', accountId: 'a1' });
});

test.each([
  ['garbage', () => Promise.resolve('not-a-jwt')],
  ['expired', () => signTestToken(keys.privateKey, { sub: 'u1', perms: ['lead.unlock'] }, '-1m')],
  [
    'signed by another key',
    () => signTestToken(createTestKeys().privateKey, { sub: 'u1', perms: ['lead.unlock'] }),
  ],
])('a guarded route, with a %s token, returns 401 not 500', async (_name, makeToken) => {
  const token = await makeToken();

  const res = await build().inject({
    method: 'GET',
    url: '/guarded',
    headers: { authorization: `Bearer ${token}` },
  });

  expect(res.statusCode).toBe(401);
});

test('a guarded route with a body schema, when the body is invalid and there is no token, returns 401 not 400', async () => {
  const app = build();
  app.post(
    '/guarded-write',
    {
      config: { permission: 'lead.unlock' },
      schema: { body: Type.Object({ note: Type.String() }) },
    },
    () => ({ ok: true }),
  );

  const res = await app.inject({ method: 'POST', url: '/guarded-write', payload: {} });

  expect(res.statusCode).toBe(401);
});

test('an unknown route, without a token, returns 404', async () => {
  const res = await build().inject({ method: 'GET', url: '/nope' });

  expect(res.statusCode).toBe(404);
  expect(res.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

test('registering a route, without permission or public, throws at registration', () => {
  const app = createApp({ serviceName: 'test', logLevel: 'silent' });
  registerAuth(app, { publicKeyPem: keys.publicKeyPem });

  expect(() => app.get('/forgot', () => ({ ok: true }))).toThrow(/permission or config\.public/);
});
