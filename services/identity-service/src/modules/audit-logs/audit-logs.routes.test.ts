import { signTestToken } from '@hanu/service-kit/testing';
import { expect, test, vi } from 'vitest';
import { buildTestApp } from '../../test-app.js';
import * as service from './audit-logs.service.js';

vi.mock('./audit-logs.service.js');

test('GET /admin/identity/audit-logs, without admin.audit.view, returns 403', async () => {
  const { app, keys } = buildTestApp();
  const token = await signTestToken(keys.privateKey, { sub: 'u1', perms: ['admin.user.manage'] });

  const res = await app.inject({
    url: '/admin/identity/audit-logs',
    headers: { authorization: `Bearer ${token}` },
  });

  expect(res.statusCode).toBe(403);
});

test('GET /admin/identity/audit-logs, with admin.audit.view, returns the page', async () => {
  vi.mocked(service.listAuditLogs).mockResolvedValue({ data: [], nextCursor: null });
  const { app, keys } = buildTestApp();
  const token = await signTestToken(keys.privateKey, { sub: 'u1', perms: ['admin.audit.view'] });

  const res = await app.inject({
    url: '/admin/identity/audit-logs?targetType=lookup',
    headers: { authorization: `Bearer ${token}` },
  });

  expect(res.statusCode).toBe(200);
  expect(service.listAuditLogs).toHaveBeenCalledWith(expect.anything(), { targetType: 'lookup' });
});
