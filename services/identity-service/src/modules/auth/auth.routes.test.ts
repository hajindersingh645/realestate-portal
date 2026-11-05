import { beforeEach, expect, test, vi } from 'vitest';
import { buildTestApp } from '../../test-app.js';
import * as sessions from '../sessions/sessions.service.js';
import * as service from './auth.service.js';

vi.mock('./auth.service.js', async (importOriginal) => ({
  ...(await importOriginal<typeof service>()),
  startLogin: vi.fn(),
  login: vi.fn(),
}));
vi.mock('../sessions/sessions.service.js', async (importOriginal) => ({
  ...(await importOriginal<typeof sessions>()),
  refreshSession: vi.fn(),
  revokeSession: vi.fn(),
}));

const user = { id: 'u1', name: 'Asha', phone: '+919815012345', email: null };
const tokens = {
  accessToken: 'access',
  refreshToken: 'sid.secret',
  refreshExpiresAt: new Date('2026-12-03T00:00:00Z'),
  user,
};

beforeEach(() => {
  vi.resetAllMocks();
});

test('POST /auth/otp, with a phone, returns 202 and starts the login', async () => {
  const { app } = buildTestApp();

  const res = await app.inject({
    method: 'POST',
    url: '/auth/otp',
    payload: { phone: '9815012345' },
  });

  expect(res.statusCode).toBe(202);
  expect(service.startLogin).toHaveBeenCalledWith(
    expect.anything(),
    expect.anything(),
    '9815012345',
  );
});

test('POST /auth/otp, without a phone, returns 400 and sends nothing', async () => {
  const { app } = buildTestApp();

  const res = await app.inject({
    method: 'POST',
    url: '/auth/otp',
    payload: { mobile: '9815012345' },
  });

  expect(res.statusCode).toBe(400);
  expect(service.startLogin).not.toHaveBeenCalled();
});

test('POST /auth/login, with a right code, returns the access token and sets a strict httpOnly cookie', async () => {
  vi.mocked(service.login).mockResolvedValue({ ok: true, tokens });
  const { app } = buildTestApp();

  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { phone: '9815012345', code: '123456' },
  });

  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ accessToken: 'access', user });
  const cookie = String(res.headers['set-cookie']);
  expect(cookie).toContain('refresh_token=sid.secret');
  expect(cookie).toContain('Path=/api/v1/auth');
  expect(cookie).toContain('HttpOnly');
  expect(cookie).toContain('Secure');
  expect(cookie).toContain('SameSite=Strict');
});

test('POST /auth/login, with a wrong code, returns 401 INVALID_OTP and sets no cookie', async () => {
  vi.mocked(service.login).mockResolvedValue({ ok: false });
  const { app } = buildTestApp();

  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { phone: '9815012345', code: '123456' },
  });

  expect(res.statusCode).toBe(401);
  expect(res.json().error.code).toBe('INVALID_OTP');
  expect(res.headers['set-cookie']).toBeUndefined();
});

test('POST /auth/login, with a five-digit code, returns 400', async () => {
  const { app } = buildTestApp();

  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { phone: '9815012345', code: '12345' },
  });

  expect(res.statusCode).toBe(400);
  expect(service.login).not.toHaveBeenCalled();
});

test('POST /auth/login, signing up as staff or with a notice id that is not a UUID, returns 400', async () => {
  const { app } = buildTestApp();
  const base = { phone: '9815012345', code: '123456', name: 'Asha', consent: true };

  const staff = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: {
      ...base,
      noticeBlockId: '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c01',
      registeredAs: 'staff',
    },
  });
  const badNotice = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { ...base, noticeBlockId: 'v1' },
  });

  expect(staff.statusCode).toBe(400);
  expect(badNotice.statusCode).toBe(400);
  expect(service.login).not.toHaveBeenCalled();
});

test('POST /auth/login, signing up as a professional, passes the side and notice id to the service', async () => {
  vi.mocked(service.login).mockResolvedValue({ ok: true, tokens });
  const { app } = buildTestApp();
  const payload = {
    phone: '9815012345',
    code: '123456',
    name: 'Ravi',
    consent: true,
    noticeBlockId: '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c01',
    registeredAs: 'professional',
  };

  const res = await app.inject({ method: 'POST', url: '/auth/login', payload });

  expect(res.statusCode).toBe(200);
  expect(vi.mocked(service.login)).toHaveBeenCalledWith(
    expect.anything(),
    expect.anything(),
    payload,
    expect.anything(),
  );
});

test('POST /auth/refresh, without the cookie, returns 401', async () => {
  const { app } = buildTestApp();

  const res = await app.inject({ method: 'POST', url: '/auth/refresh' });

  expect(res.statusCode).toBe(401);
  expect(sessions.refreshSession).not.toHaveBeenCalled();
});

test('POST /auth/refresh, with a valid cookie, returns a new access token and a rotated cookie', async () => {
  vi.mocked(sessions.refreshSession).mockResolvedValue({
    ok: true,
    tokens: { ...tokens, refreshToken: 'sid.next' },
  });
  const { app } = buildTestApp();

  const res = await app.inject({
    method: 'POST',
    url: '/auth/refresh',
    cookies: { refresh_token: 'sid.secret' },
  });

  expect(res.statusCode).toBe(200);
  expect(String(res.headers['set-cookie'])).toContain('refresh_token=sid.next');
});

test('POST /auth/refresh, when the session is refused, returns 401', async () => {
  vi.mocked(sessions.refreshSession).mockResolvedValue({ ok: false });
  const { app } = buildTestApp();

  const res = await app.inject({
    method: 'POST',
    url: '/auth/refresh',
    cookies: { refresh_token: 'sid.old' },
  });

  expect(res.statusCode).toBe(401);
});

test('POST /auth/logout, with a cookie, revokes the session and clears the cookie', async () => {
  const { app } = buildTestApp();

  const res = await app.inject({
    method: 'POST',
    url: '/auth/logout',
    cookies: { refresh_token: 'sid.secret' },
  });

  expect(res.statusCode).toBe(204);
  expect(sessions.revokeSession).toHaveBeenCalledWith(expect.anything(), 'sid.secret');
  expect(String(res.headers['set-cookie'])).toMatch(/refresh_token=;.*Expires=Thu, 01 Jan 1970/);
});
