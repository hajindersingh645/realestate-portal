import { ConflictError, NotFoundError } from '@hanu/service-kit';
import { signTestToken } from '@hanu/service-kit/testing';
import { beforeEach, expect, test, vi } from 'vitest';
import { buildTestApp } from '../../test-app.js';
import * as service from './accounts.service.js';

vi.mock('./accounts.service.js');

const AREA = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c01';
const BODY = { type: 'agent', displayName: 'Ravi Realty', locationIds: [AREA] };
const view: service.MyAccountView = {
  id: '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c02',
  type: 'agent',
  displayName: 'Ravi Realty',
  slug: 'ravi-realty',
  about: null,
  experienceYears: null,
  specialisations: [],
  licenseNumber: null,
  status: 'pending',
  areas: [{ locationId: AREA, cityId: AREA }],
  rejectReason: null,
  license: { label: 'RERA', mandatory: false },
};

beforeEach(() => {
  vi.resetAllMocks();
});

async function setup(perms: string[] = []) {
  const { app, keys } = buildTestApp();
  const token = await signTestToken(keys.privateKey, { sub: 'u1', perms });
  return { app, headers: { authorization: `Bearer ${token}` } };
}

test('GET /accounts/me, without a token, returns 401', async () => {
  const { app } = buildTestApp();

  const res = await app.inject({ method: 'GET', url: '/accounts/me' });

  expect(res.statusCode).toBe(401);
});

test('GET /accounts/me, for a user without an account, returns 404', async () => {
  vi.mocked(service.getMyAccount).mockRejectedValue(new NotFoundError());
  const { app, headers } = await setup();

  const res = await app.inject({ method: 'GET', url: '/accounts/me', headers });

  expect(res.statusCode).toBe(404);
});

test('POST /accounts/me, signed in with a valid body, returns 201 and passes the catalog URL', async () => {
  vi.mocked(service.createAccount).mockResolvedValue(view);
  const { app, headers } = await setup();

  const res = await app.inject({ method: 'POST', url: '/accounts/me', payload: BODY, headers });

  expect(res.statusCode).toBe(201);
  expect(res.json()).toEqual(view);
  expect(vi.mocked(service.createAccount)).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ userId: 'u1' }),
    { catalogUrl: 'http://catalog.test' },
    BODY,
  );
});

test.each([
  ['no areas', { ...BODY, locationIds: [] }],
  ['51 areas', { ...BODY, locationIds: Array.from({ length: 51 }, () => AREA) }],
  ['an unknown type', { ...BODY, type: 'broker' }],
  ['a one-letter name', { ...BODY, displayName: 'R' }],
])('POST /accounts/me, with %s, returns 400', async (_, payload) => {
  const { app, headers } = await setup();

  const res = await app.inject({ method: 'POST', url: '/accounts/me', payload, headers });

  expect(res.statusCode).toBe(400);
  expect(service.createAccount).not.toHaveBeenCalled();
});

test('POST /accounts/me, with a status field, drops it before the service (staff own the status)', async () => {
  vi.mocked(service.createAccount).mockResolvedValue(view);
  const { app, headers } = await setup();

  const res = await app.inject({
    method: 'POST',
    url: '/accounts/me',
    payload: { ...BODY, status: 'approved' },
    headers,
  });

  expect(res.statusCode).toBe(201);
  expect(vi.mocked(service.createAccount).mock.calls[0]?.[3]).not.toHaveProperty('status');
});

test('POST /accounts/me, when the user already has an account, returns 409', async () => {
  vi.mocked(service.createAccount).mockRejectedValue(new ConflictError());
  const { app, headers } = await setup();

  const res = await app.inject({ method: 'POST', url: '/accounts/me', payload: BODY, headers });

  expect(res.statusCode).toBe(409);
});

test('PATCH /accounts/me, without profile.manage, returns 403', async () => {
  const { app, headers } = await setup();

  const res = await app.inject({
    method: 'PATCH',
    url: '/accounts/me',
    payload: { about: 'x' },
    headers,
  });

  expect(res.statusCode).toBe(403);
});

test('PATCH /accounts/me, with only a status or a type (no editable field), returns 400', async () => {
  const { app, headers } = await setup(['profile.manage']);

  const status = await app.inject({
    method: 'PATCH',
    url: '/accounts/me',
    payload: { status: 'approved' },
    headers,
  });
  const type = await app.inject({
    method: 'PATCH',
    url: '/accounts/me',
    payload: { type: 'agency' },
    headers,
  });

  expect(status.statusCode).toBe(400);
  expect(type.statusCode).toBe(400);
  expect(service.updateMyAccount).not.toHaveBeenCalled();
});

test('PATCH /accounts/me, with a slug that is not lowercase-hyphenated, returns 400', async () => {
  const { app, headers } = await setup(['profile.manage']);

  const res = await app.inject({
    method: 'PATCH',
    url: '/accounts/me',
    payload: { slug: 'Ravi Realty' },
    headers,
  });

  expect(res.statusCode).toBe(400);
});

test('PATCH /accounts/me, with profile.manage, returns the updated account', async () => {
  vi.mocked(service.updateMyAccount).mockResolvedValue({ ...view, about: 'New' });
  const { app, headers } = await setup(['profile.manage']);

  const res = await app.inject({
    method: 'PATCH',
    url: '/accounts/me',
    payload: { about: 'New' },
    headers,
  });

  expect(res.statusCode).toBe(200);
  expect(res.json()).toMatchObject({ about: 'New' });
});

test('POST /accounts/me/resubmit, with profile.manage, returns 200; from a wrong status, 409', async () => {
  vi.mocked(service.resubmitMyAccount)
    .mockResolvedValueOnce(view)
    .mockRejectedValueOnce(new ConflictError());
  const { app, headers } = await setup(['profile.manage']);

  const ok = await app.inject({ method: 'POST', url: '/accounts/me/resubmit', headers });
  const wrong = await app.inject({ method: 'POST', url: '/accounts/me/resubmit', headers });

  expect(ok.statusCode).toBe(200);
  expect(wrong.statusCode).toBe(409);
});
