import { expect, test } from 'vitest';
import { buildGateway } from './app.js';

function build(rateLimitMax = 100) {
  return buildGateway({
    routes: [{ prefix: '/api/v1/catalog', upstream: 'http://127.0.0.1:1' }],
    corsOrigins: ['http://localhost:5173'],
    rateLimitMax,
    logLevel: 'silent',
  });
}

test('GET /health, always, returns ok with security headers', async () => {
  const app = await build();

  const res = await app.inject({ method: 'GET', url: '/health' });

  expect(res.statusCode).toBe(200);
  expect(res.headers['x-content-type-options']).toBe('nosniff');
});

test.each(['/api/v1/catalog/internal/charges', '/api/v1/catalog/INTERNAL/x', '/internal/x'])(
  'a request to %s, always, returns 404 without contacting an upstream',
  async (url) => {
    const app = await build();

    const res = await app.inject({ method: 'GET', url });

    expect(res.statusCode).toBe(404);
  },
);

test('one client, after exceeding the rate limit, receives 429', async () => {
  const app = await build(2);

  await app.inject({ method: 'GET', url: '/api/v1/catalog/x' });
  await app.inject({ method: 'GET', url: '/api/v1/catalog/x' });
  const res = await app.inject({ method: 'GET', url: '/api/v1/catalog/x' });

  expect(res.statusCode).toBe(429);
  expect(res.json().error.code).toBeTypeOf('string');
});

test('GET /health, however often it is called, is not rate limited', async () => {
  const app = await build(2);

  await app.inject({ method: 'GET', url: '/health' });
  await app.inject({ method: 'GET', url: '/health' });
  const res = await app.inject({ method: 'GET', url: '/health' });

  expect(res.statusCode).toBe(200);
});

test('a preflight from an allowed origin, always, is accepted', async () => {
  const app = await build();

  const res = await app.inject({
    method: 'OPTIONS',
    url: '/api/v1/catalog/demo/pings',
    headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'POST' },
  });

  expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
});

test('a proxied request, when the upstream is down, returns 503 without internal details', async () => {
  const app = await build();

  const res = await app.inject({ method: 'GET', url: '/api/v1/catalog/demo/pings' });

  expect(res.statusCode).toBe(503);
  expect(res.json()).toEqual({
    error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Service unavailable' },
  });
});
