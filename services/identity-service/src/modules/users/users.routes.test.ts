import { signTestToken } from '@hanu/service-kit/testing';
import { beforeEach, expect, test, vi } from 'vitest';
import { buildTestApp } from '../../test-app.js';
import * as service from './users.service.js';

vi.mock('./users.service.js');

const me = {
  id: 'u1',
  name: 'Asha',
  phone: '+919815012345',
  email: null,
  registeredAs: 'buyer',
  permissions: ['review.create'],
};

beforeEach(() => {
  vi.resetAllMocks();
});

test('GET /users/me, without a token, returns 401', async () => {
  const { app } = buildTestApp();

  const res = await app.inject({ url: '/users/me' });

  expect(res.statusCode).toBe(401);
});

test('GET /users/me, with a token holding no permissions, returns the caller', async () => {
  vi.mocked(service.getMe).mockResolvedValue(me);
  const { app, keys } = buildTestApp();
  const token = await signTestToken(keys.privateKey, { sub: 'u1' });

  const res = await app.inject({ url: '/users/me', headers: { authorization: `Bearer ${token}` } });

  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual(me);
  expect(service.getMe).toHaveBeenCalledWith(expect.anything(), 'u1');
});

test('PATCH /users/me, with no known field, returns 400 and changes nothing', async () => {
  const { app, keys } = buildTestApp();
  const token = await signTestToken(keys.privateKey, { sub: 'u1' });

  for (const payload of [{}, { phone: '+919815000000' }]) {
    const res = await app.inject({
      method: 'PATCH',
      url: '/users/me',
      headers: { authorization: `Bearer ${token}` },
      payload,
    });
    expect(res.statusCode).toBe(400);
  }
  expect(service.updateMe).not.toHaveBeenCalled();
});

test('PATCH /users/me, with an email without a domain, returns 400', async () => {
  const { app, keys } = buildTestApp();
  const token = await signTestToken(keys.privateKey, { sub: 'u1' });

  const res = await app.inject({
    method: 'PATCH',
    url: '/users/me',
    headers: { authorization: `Bearer ${token}` },
    payload: { email: 'asha@' },
  });

  expect(res.statusCode).toBe(400);
});
