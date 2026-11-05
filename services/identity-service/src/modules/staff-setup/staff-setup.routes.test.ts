import { signTestToken } from '@hanu/service-kit/testing';
import { beforeEach, expect, test, vi } from 'vitest';
import { buildTestApp } from '../../test-app.js';
import * as service from './staff-setup.service.js';

vi.mock('./staff-setup.service.js', async (importOriginal) => ({
  ...(await importOriginal<typeof service>()),
  createStaff: vi.fn(),
  issueSetupLink: vi.fn(),
  completeSetup: vi.fn(),
}));

const ROLE = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c01';
const staff = { name: 'Priya', email: 'p@hanu.test', phone: '9815012345', roleIds: [ROLE] };

beforeEach(() => {
  vi.resetAllMocks();
});

async function post(perms: string[] | null, url: string, payload: object) {
  const { app, keys } = buildTestApp();
  const headers =
    perms === null
      ? {}
      : {
          authorization: `Bearer ${await signTestToken(keys.privateKey, { sub: 'admin', perms })}`,
        };
  return await app.inject({ method: 'POST', url, headers, payload });
}

test('POST /admin/identity/staff, without admin.access.manage, returns 403', async () => {
  const res = await post(['admin.user.manage'], '/admin/identity/staff', staff);

  expect(res.statusCode).toBe(403);
  expect(service.createStaff).not.toHaveBeenCalled();
});

test('POST /admin/identity/staff, with roleIds [], returns 400', async () => {
  const res = await post(['admin.access.manage'], '/admin/identity/staff', {
    ...staff,
    roleIds: [],
  });

  expect(res.statusCode).toBe(400);
});

test('POST /admin/identity/staff, with admin.access.manage, returns 201 with the setup link', async () => {
  const created = {
    userId: ROLE,
    setupUrl: 'http://admin.test/setup?token=t',
    expiresAt: '2026-11-06T10:00:00.000Z',
  };
  vi.mocked(service.createStaff).mockResolvedValue(created);

  const res = await post(['admin.access.manage'], '/admin/identity/staff', staff);

  expect(res.statusCode).toBe(201);
  expect(res.json()).toEqual(created);
});

test('POST /admin/identity/staff/:id/setup-link, with admin.access.manage, returns 201 with a new link', async () => {
  const link = {
    setupUrl: 'http://admin.test/setup?token=n',
    expiresAt: '2026-11-06T10:00:00.000Z',
  };
  vi.mocked(service.issueSetupLink).mockResolvedValue(link);

  const res = await post(['admin.access.manage'], `/admin/identity/staff/${ROLE}/setup-link`, {});

  expect(res.statusCode).toBe(201);
  expect(res.json()).toEqual(link);
});

test('POST /auth/staff/setup, with a 5-character password, returns 400 and does not call completeSetup', async () => {
  const res = await post(null, '/auth/staff/setup', { token: 'x'.repeat(43), password: 'short' });

  expect(res.statusCode).toBe(400);
  expect(service.completeSetup).not.toHaveBeenCalled();
});

test('POST /auth/staff/setup, with a used link, returns 400 SETUP_LINK_INVALID', async () => {
  vi.mocked(service.completeSetup).mockRejectedValue(new service.SetupLinkInvalidError());

  const res = await post(null, '/auth/staff/setup', {
    token: 'x'.repeat(43),
    password: 'a long enough password',
  });

  expect(res.statusCode).toBe(400);
  expect(res.json().error.code).toBe('SETUP_LINK_INVALID');
});

test('POST /auth/staff/setup, with a valid link, returns 204', async () => {
  vi.mocked(service.completeSetup).mockResolvedValue();

  const res = await post(null, '/auth/staff/setup', {
    token: 'x'.repeat(43),
    password: 'a long enough password',
  });

  expect(res.statusCode).toBe(204);
});
