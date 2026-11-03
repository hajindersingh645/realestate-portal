import { createApp, registerAuth } from '@hanu/service-kit';
import { createTestKeys } from '@hanu/service-kit/testing';
import { randomUUID } from 'node:crypto';
import { decodeJwt } from 'jose';
import { expect, test } from 'vitest';
import { newRefreshToken, parseRefreshToken, signAccessToken } from './tokens.js';

const keys = createTestKeys();

test('signAccessToken, verified by the kit auth, carries the user id and exactly the perms', async () => {
  const app = createApp({ serviceName: 'test', logLevel: 'silent' });
  registerAuth(app, { publicKeyPem: keys.publicKeyPem });
  app.get('/probe', { config: { permission: 'lead.unlock' } }, (request) => request.auth ?? {});
  const token = await signAccessToken(keys.privateKey, 'user-1', ['lead.unlock', 'review.create']);

  const response = await app.inject({
    url: '/probe',
    headers: { authorization: `Bearer ${token}` },
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ userId: 'user-1', perms: ['lead.unlock', 'review.create'] });
});

test('signAccessToken, for any user, expires 10 minutes after it is issued', async () => {
  const claims = decodeJwt(await signAccessToken(keys.privateKey, 'user-1', []));

  expect((claims.exp ?? 0) - (claims.iat ?? 0)).toBe(600);
});

test('newRefreshToken, parsed back, gives the session id and the stored hash', () => {
  const sessionId = randomUUID();
  const { token, hash } = newRefreshToken(sessionId);

  expect(parseRefreshToken(token)).toEqual({ sessionId, hash });
  expect(token).not.toContain(hash);
});

test('parseRefreshToken, for malformed input, returns null', () => {
  expect(parseRefreshToken('no-dot')).toBeNull();
  expect(parseRefreshToken('not-a-uuid.secret')).toBeNull();
  expect(parseRefreshToken(`${randomUUID()}.`)).toBeNull();
});
