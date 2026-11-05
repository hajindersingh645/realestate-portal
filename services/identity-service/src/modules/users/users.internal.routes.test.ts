import { NotFoundError } from '@hanu/service-kit';
import { beforeEach, expect, test, vi } from 'vitest';
import { buildTestApp } from '../../test-app.js';
import * as service from './users.service.js';

vi.mock('./users.service.js');

const ID = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c01';

beforeEach(() => {
  vi.resetAllMocks();
});

test('GET /internal/users/:id, for a known user, returns the contact and side without a token', async () => {
  const user = {
    id: ID,
    name: 'Asha',
    phone: '+919815012345',
    registeredAs: 'buyer',
    status: 'active',
  };
  vi.mocked(service.getUserForService).mockResolvedValue(user);
  const { app } = buildTestApp();

  const res = await app.inject({ method: 'GET', url: `/internal/users/${ID}` });

  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual(user);
  expect(vi.mocked(service.getUserForService).mock.calls[0]?.[1]).toBe(ID);
});

test('GET /internal/users/:id, for an unknown user, returns 404', async () => {
  vi.mocked(service.getUserForService).mockRejectedValue(new NotFoundError('User not found'));
  const { app } = buildTestApp();

  const res = await app.inject({ method: 'GET', url: `/internal/users/${ID}` });

  expect(res.statusCode).toBe(404);
});

test('GET /internal/users/:id, with an id that is not a UUID, returns 400', async () => {
  const { app } = buildTestApp();

  const res = await app.inject({ method: 'GET', url: '/internal/users/nope' });

  expect(res.statusCode).toBe(400);
  expect(vi.mocked(service.getUserForService)).not.toHaveBeenCalled();
});
