import { beforeEach, expect, test, vi } from 'vitest';
import { buildTestApp } from '../../test-app.js';
import * as service from './staff-auth.service.js';

vi.mock('./staff-auth.service.js', async (importOriginal) => ({
  ...(await importOriginal<typeof service>()),
  startStaffLogin: vi.fn(),
  verifyStaffLogin: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

test('POST /auth/staff/login, with valid credentials, returns 202 and the challenge id', async () => {
  vi.mocked(service.startStaffLogin).mockResolvedValue({ challengeId: 'c1' });
  const { app } = buildTestApp();

  const res = await app.inject({
    method: 'POST',
    url: '/auth/staff/login',
    payload: { email: 'admin@hanu.property', password: 'secret' },
  });

  expect(res.statusCode).toBe(202);
  expect(res.json()).toEqual({ challengeId: 'c1' });
});

test('POST /auth/staff/login, with wrong credentials, returns 401 INVALID_CREDENTIALS', async () => {
  vi.mocked(service.startStaffLogin).mockRejectedValue(new service.InvalidCredentialsError());
  const { app } = buildTestApp();

  const res = await app.inject({
    method: 'POST',
    url: '/auth/staff/login',
    payload: { email: 'admin@hanu.property', password: 'wrong' },
  });

  expect(res.statusCode).toBe(401);
  expect(res.json()).toEqual({
    error: { code: 'INVALID_CREDENTIALS', message: 'Wrong email or password' },
  });
});

test('POST /auth/staff/verify, with a refused code, returns 401 INVALID_OTP', async () => {
  vi.mocked(service.verifyStaffLogin).mockResolvedValue({ ok: false });
  const { app } = buildTestApp();

  const res = await app.inject({
    method: 'POST',
    url: '/auth/staff/verify',
    payload: { challengeId: '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c01', code: '123456' },
  });

  expect(res.statusCode).toBe(401);
  expect(res.json().error.code).toBe('INVALID_OTP');
});
