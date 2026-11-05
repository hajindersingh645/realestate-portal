import { http, HttpResponse } from 'msw/http';
import { beforeEach, expect, test } from 'vitest';
import { useSession } from '../session/session-store';
import { fakeToken, TEST_USER } from '../testing/tokens';
import { server } from '../testing/server';
import { api } from './client';
import { ApiError } from './errors';

beforeEach(() => {
  useSession.getState().signIn({ accessToken: fakeToken([]), user: TEST_USER });
});

test('api, when two calls get 401 at the same time, refreshes once and retries both', async () => {
  let refreshes = 0;
  const fresh = fakeToken(['admin.catalog.manage']);
  server.use(
    http.get('/api/v1/thing', ({ request }) =>
      request.headers.get('authorization') === `Bearer ${fresh}`
        ? HttpResponse.json({ ok: true })
        : HttpResponse.json(
            { error: { code: 'TOKEN_REVOKED', message: 'Token revoked' } },
            { status: 401 },
          ),
    ),
    http.post('/api/v1/auth/refresh', () => {
      refreshes += 1;
      return HttpResponse.json({ accessToken: fresh, user: TEST_USER });
    }),
  );

  const results = await Promise.all([api('/thing'), api('/thing')]);

  expect(refreshes).toBe(1);
  expect(results).toEqual([{ ok: true }, { ok: true }]);
});

test('api, when the retry after refresh is still 401, signs out and throws ApiError 401', async () => {
  server.use(
    http.get('/api/v1/thing', () =>
      HttpResponse.json({ error: { code: 'UNAUTHORIZED', message: 'No' } }, { status: 401 }),
    ),
    http.post('/api/v1/auth/refresh', () =>
      HttpResponse.json({ error: { code: 'UNAUTHORIZED', message: 'No' } }, { status: 401 }),
    ),
  );

  const call = api('/thing');

  await expect(call).rejects.toMatchObject({ status: 401 });
  expect(useSession.getState().status).toBe('signed-out');
});

test('api, on a 400 with body/name and body/slug errors, throws ApiError with fields.name and fields.slug', async () => {
  server.use(
    http.post('/api/v1/thing', () =>
      HttpResponse.json(
        {
          error: {
            code: 'VALIDATION',
            message:
              'body/name must NOT have fewer than 1 characters, body/slug must match pattern "^[a-z0-9-]+$"',
          },
        },
        { status: 400 },
      ),
    ),
  );

  const error = await api('/thing', { method: 'POST', body: {} }).catch((e: unknown) => e);

  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).fields).toEqual({
    name: 'must NOT have fewer than 1 characters',
    slug: 'must match pattern "^[a-z0-9-]+$"',
  });
});

test('api, on a 204, resolves to undefined', async () => {
  server.use(http.delete('/api/v1/thing', () => new HttpResponse(null, { status: 204 })));

  await expect(api('/thing', { method: 'DELETE' })).resolves.toBeUndefined();
});

test('api, for an /auth/ path that answers 401 (wrong password or code), throws without trying to refresh', async () => {
  let refreshes = 0;
  server.use(
    http.post('/api/v1/auth/staff/verify', () =>
      HttpResponse.json({ error: { code: 'INVALID_OTP', message: 'Wrong code' } }, { status: 401 }),
    ),
    http.post('/api/v1/auth/refresh', () => {
      refreshes += 1;
      return HttpResponse.json({ error: { code: 'UNAUTHORIZED', message: 'No' } }, { status: 401 });
    }),
  );

  const error = await api('/auth/staff/verify', { method: 'POST', body: {} }).catch(
    (e: unknown) => e,
  );

  expect(error).toMatchObject({ status: 401, code: 'INVALID_OTP' });
  expect(refreshes).toBe(0);
});

test('api, for a 202 with an empty body, resolves to undefined', async () => {
  server.use(http.post('/api/v1/auth/otp', () => new HttpResponse(null, { status: 202 })));

  await expect(
    api('/auth/otp', { method: 'POST', body: { phone: '9815020001' } }),
  ).resolves.toBeUndefined();
});
