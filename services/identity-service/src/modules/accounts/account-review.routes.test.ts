import { ConflictError, NotFoundError } from '@hanu/service-kit';
import { signTestToken } from '@hanu/service-kit/testing';
import { beforeEach, expect, test, vi } from 'vitest';
import { buildTestApp } from '../../test-app.js';
import * as service from './account-review.service.js';

vi.mock('./account-review.service.js');

const ID = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c02';
const view: service.StaffAccountView = {
  id: ID,
  type: 'agent',
  displayName: 'Ravi Realty',
  slug: 'ravi-realty',
  about: null,
  experienceYears: null,
  specialisations: [],
  licenseNumber: null,
  status: 'approved',
  createdAt: '2026-11-05T07:00:00.000000Z',
  owner: { userId: 'u2', name: 'Ravi', phone: '+919815012345', email: null },
  areas: [],
  transitions: [],
};

beforeEach(() => {
  vi.resetAllMocks();
});

async function setup(perms: string[] = ['admin.account.review']) {
  const { app, keys } = buildTestApp();
  const token = await signTestToken(keys.privateKey, { sub: 'u1', perms });
  return { app, headers: { authorization: `Bearer ${token}` } };
}

test('GET /admin/identity/accounts, without a token, returns 401', async () => {
  const { app } = buildTestApp();

  const res = await app.inject({ method: 'GET', url: '/admin/identity/accounts' });

  expect(res.statusCode).toBe(401);
});

test('GET /admin/identity/accounts, without admin.account.review, returns 403', async () => {
  const { app, headers } = await setup(['profile.manage']);

  const res = await app.inject({ method: 'GET', url: '/admin/identity/accounts', headers });

  expect(res.statusCode).toBe(403);
  expect(service.listAccountsForStaff).not.toHaveBeenCalled();
});

test('GET /admin/identity/accounts, with filters, passes them and returns the page', async () => {
  vi.mocked(service.listAccountsForStaff).mockResolvedValue({ data: [], nextCursor: null });
  const { app, headers } = await setup();

  const res = await app.inject({
    method: 'GET',
    url: '/admin/identity/accounts?status=pending&type=agent&q=ravi',
    headers,
  });

  expect(res.statusCode).toBe(200);
  expect(vi.mocked(service.listAccountsForStaff).mock.calls[0]?.[1]).toEqual({
    status: 'pending',
    type: 'agent',
    q: 'ravi',
  });
});

test('GET /admin/identity/accounts, with an unknown status, returns 400', async () => {
  const { app, headers } = await setup();

  const res = await app.inject({
    method: 'GET',
    url: '/admin/identity/accounts?status=live',
    headers,
  });

  expect(res.statusCode).toBe(400);
});

test('GET /admin/identity/accounts/:id, for a missing account, returns 404', async () => {
  vi.mocked(service.getAccountForStaff).mockRejectedValue(new NotFoundError());
  const { app, headers } = await setup();

  const res = await app.inject({ method: 'GET', url: `/admin/identity/accounts/${ID}`, headers });

  expect(res.statusCode).toBe(404);
});

test('POST /admin/identity/accounts/:id/decision, with an action and reason, returns 200 and passes the staff actor', async () => {
  vi.mocked(service.decideAccount).mockResolvedValue(view);
  const { app, headers } = await setup();

  const res = await app.inject({
    method: 'POST',
    url: `/admin/identity/accounts/${ID}/decision`,
    payload: { action: 'suspend', reason: 'Complaints' },
    headers,
  });

  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual(view);
  const [, actor, id, action, reason] = vi.mocked(service.decideAccount).mock.calls[0] ?? [];
  expect(actor).toMatchObject({ userId: 'u1' });
  expect([id, action, reason]).toEqual([ID, 'suspend', 'Complaints']);
});

test.each([{}, { action: 'delete' }, { action: 'approve', reason: 'x'.repeat(501) }])(
  'POST /admin/identity/accounts/:id/decision, with body %j, returns 400',
  async (payload) => {
    const { app, headers } = await setup();

    const res = await app.inject({
      method: 'POST',
      url: `/admin/identity/accounts/${ID}/decision`,
      payload,
      headers,
    });

    expect(res.statusCode).toBe(400);
    expect(service.decideAccount).not.toHaveBeenCalled();
  },
);

test('POST /admin/identity/accounts/:id/decision, when the move is not allowed, returns 409', async () => {
  vi.mocked(service.decideAccount).mockRejectedValue(
    new ConflictError('A banned account cannot be given "reactivate"'),
  );
  const { app, headers } = await setup();

  const res = await app.inject({
    method: 'POST',
    url: `/admin/identity/accounts/${ID}/decision`,
    payload: { action: 'reactivate', reason: 'Appeal' },
    headers,
  });

  expect(res.statusCode).toBe(409);
});

test('POST /admin/identity/accounts/not-a-uuid/decision returns 400', async () => {
  const { app, headers } = await setup();

  const res = await app.inject({
    method: 'POST',
    url: '/admin/identity/accounts/not-a-uuid/decision',
    payload: { action: 'approve' },
    headers,
  });

  expect(res.statusCode).toBe(400);
});

test('GET /admin/identity/accounts/counts, with filters, passes them and returns the counts', async () => {
  const counts = { pending: 0, approved: 3, rejected: 1, suspended: 0, banned: 0, all: 4 };
  vi.mocked(service.countAccountsForStaff).mockResolvedValue(counts);
  const { app, headers } = await setup();

  const res = await app.inject({
    method: 'GET',
    url: '/admin/identity/accounts/counts?type=agent&q=ravi',
    headers,
  });

  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual(counts);
  expect(vi.mocked(service.countAccountsForStaff).mock.calls[0]?.[1]).toEqual({
    type: 'agent',
    q: 'ravi',
  });
  expect(service.getAccountForStaff).not.toHaveBeenCalled();
});

test('GET /admin/identity/accounts/counts, without admin.account.review, returns 403', async () => {
  const { app, headers } = await setup(['profile.manage']);

  const res = await app.inject({ method: 'GET', url: '/admin/identity/accounts/counts', headers });

  expect(res.statusCode).toBe(403);
});
