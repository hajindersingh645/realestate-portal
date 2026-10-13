import { Type } from 'typebox';
import { expect, test } from 'vitest';
import { createApp } from './app.js';
import { NotFoundError } from './errors.js';

function build() {
  return createApp({ serviceName: 'test', logLevel: 'silent' });
}

test('GET /health, always, returns ok', async () => {
  const app = build();

  const res = await app.inject({ method: 'GET', url: '/health' });

  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ status: 'ok' });
});

test('GET /ready, when a ready check rejects, returns 503', async () => {
  const app = createApp({
    serviceName: 'test',
    logLevel: 'silent',
    readyChecks: [() => Promise.reject(new Error('db down'))],
  });

  const res = await app.inject({ method: 'GET', url: '/ready' });

  expect(res.statusCode).toBe(503);
});

test('a route, when it throws an AppError, returns its status and code', async () => {
  const app = build();
  app.get('/x', () => {
    throw new NotFoundError('Ping not found');
  });

  const res = await app.inject({ method: 'GET', url: '/x' });

  expect(res.statusCode).toBe(404);
  expect(res.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'Ping not found' } });
});

test('a route, when it throws an unknown error, returns 500 without the message', async () => {
  const app = build();
  app.get('/x', () => {
    throw new Error('password=hunter2 leaked');
  });

  const res = await app.inject({ method: 'GET', url: '/x' });

  expect(res.statusCode).toBe(500);
  expect(res.body).not.toContain('hunter2');
  expect(res.json()).toEqual({ error: { code: 'INTERNAL', message: 'Internal error' } });
});

test('a route with a body schema, when a required field is missing, returns 400 VALIDATION', async () => {
  const app = build();
  app.post('/x', { schema: { body: Type.Object({ note: Type.String() }) } }, () => ({ ok: true }));

  const res = await app.inject({ method: 'POST', url: '/x', payload: {} });

  expect(res.statusCode).toBe(400);
  expect(res.json().error.code).toBe('VALIDATION');
});

test('a route with a response schema, when the handler returns extra fields, strips them', async () => {
  const app = build();
  app.get('/x', { schema: { response: { 200: Type.Object({ id: Type.String() }) } } }, () => ({
    id: 'a',
    phone: '9999999999',
  }));

  const res = await app.inject({ method: 'GET', url: '/x' });

  expect(res.json()).toEqual({ id: 'a' });
});

test('any request, when the body exceeds 1 MB, returns 413 in the error shape', async () => {
  const app = build();
  app.post('/x', () => ({ ok: true }));

  const res = await app.inject({
    method: 'POST',
    url: '/x',
    payload: { blob: 'a'.repeat(1_100_000) },
  });

  expect(res.statusCode).toBe(413);
  expect(res.json().error.code).toBeTypeOf('string');
});

test('any response, when the request carried x-request-id, echoes it', async () => {
  const app = build();

  const res = await app.inject({
    method: 'GET',
    url: '/health',
    headers: { 'x-request-id': 'r-1' },
  });

  expect(res.headers['x-request-id']).toBe('r-1');
});
