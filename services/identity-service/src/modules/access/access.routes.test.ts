import { signTestToken } from '@hanu/service-kit/testing';
import { beforeEach, expect, test, vi } from 'vitest';
import { buildTestApp } from '../../test-app.js';
import * as roles from './roles.service.js';

vi.mock('./roles.service.js');

const ID = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c01';

beforeEach(() => {
  vi.resetAllMocks();
});

async function call(
  perms: string[] | null,
  method: 'GET' | 'PATCH',
  url: string,
  payload?: object,
) {
  const { app, keys } = buildTestApp();
  const headers =
    perms === null
      ? {}
      : {
          authorization: `Bearer ${await signTestToken(keys.privateKey, { sub: 'admin', perms })}`,
        };
  return await app.inject({ method, url, headers, ...(payload === undefined ? {} : { payload }) });
}

test('GET /admin/identity/roles, without a token, returns 401', async () => {
  expect((await call(null, 'GET', '/admin/identity/roles')).statusCode).toBe(401);
});

test('GET /admin/identity/roles, with admin.user.manage only, returns 403', async () => {
  expect((await call(['admin.user.manage'], 'GET', '/admin/identity/roles')).statusCode).toBe(403);
});

test('GET /admin/identity/roles, with admin.access.manage, returns the roles', async () => {
  vi.mocked(roles.listRoles).mockResolvedValue([]);

  const res = await call(['admin.access.manage'], 'GET', '/admin/identity/roles');

  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ data: [] });
});

test('PATCH /admin/identity/roles/:id, with no known field, returns 400 and changes nothing', async () => {
  const res = await call(['admin.access.manage'], 'PATCH', `/admin/identity/roles/${ID}`, {
    key: 'x',
  });

  expect(res.statusCode).toBe(400);
  expect(roles.updateRole).not.toHaveBeenCalled();
});

test('GET /admin/identity/users, with admin.access.manage only, returns 403', async () => {
  expect((await call(['admin.access.manage'], 'GET', '/admin/identity/users')).statusCode).toBe(
    403,
  );
});
