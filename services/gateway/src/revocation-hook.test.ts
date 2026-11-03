import { generateKeyPairSync } from 'node:crypto';
import { SignJWT } from 'jose';
import { expect, test } from 'vitest';
import { buildGateway } from './app.js';
import { RevocationList } from './revocation.js';

const USER = '0b6c3f0e-6c1a-4b8e-9d2f-1a2b3c4d5e6f';
const keys = generateKeyPairSync('ed25519');
const publicKeyPem = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString();

function token(issuedAtSeconds: number, key = keys.privateKey): Promise<string> {
  return new SignJWT({ perms: [] })
    .setProtectedHeader({ alg: 'EdDSA' })
    .setSubject(USER)
    .setIssuedAt(issuedAtSeconds)
    .setExpirationTime(issuedAtSeconds + 600)
    .sign(key);
}

async function build(list: RevocationList, authMax = 1000) {
  return await buildGateway({
    routes: [
      { prefix: '/api/v1/catalog', upstream: 'http://127.0.0.1:1', rewritePrefix: '' },
      {
        prefix: '/api/v1/auth',
        upstream: 'http://127.0.0.1:1',
        rewritePrefix: '/auth',
        rateLimitMax: authMax,
      },
    ],
    corsOrigins: [],
    rateLimitMax: 1000,
    logLevel: 'silent',
    revocation: { publicKeyPem, list },
  });
}

const nowS = Math.floor(Date.now() / 1000);

test('a request, with a token issued before the user access changed, returns 401 TOKEN_REVOKED', async () => {
  const list = new RevocationList();
  list.record(USER, new Date());
  const app = await build(list);

  const res = await app.inject({
    method: 'GET',
    url: '/api/v1/catalog/x',
    headers: { authorization: `Bearer ${await token(nowS - 60)}` },
  });

  expect(res.statusCode).toBe(401);
  expect(res.json().error.code).toBe('TOKEN_REVOKED');
});

test('a request, with a token issued after the change, is passed to the upstream', async () => {
  const list = new RevocationList();
  list.record(USER, new Date((nowS - 60) * 1000));
  const app = await build(list);

  const res = await app.inject({
    method: 'GET',
    url: '/api/v1/catalog/x',
    headers: { authorization: `Bearer ${await token(nowS)}` },
  });

  expect(res.statusCode).toBe(503); // upstream down: the gateway let it through
});

test('a request, with a forged or malformed token, is left for the service to refuse', async () => {
  const list = new RevocationList();
  list.record(USER, new Date());
  const app = await build(list);
  const forged = await token(nowS - 60, generateKeyPairSync('ed25519').privateKey);

  const forgedRes = await app.inject({
    method: 'GET',
    url: '/api/v1/catalog/x',
    headers: { authorization: `Bearer ${forged}` },
  });
  const junkRes = await app.inject({
    method: 'GET',
    url: '/api/v1/catalog/x',
    headers: { authorization: 'Bearer not-a-jwt' },
  });

  expect(forgedRes.statusCode).toBe(503);
  expect(junkRes.statusCode).toBe(503);
});

test('the auth prefix, after its own limit, returns 429 while other routes still pass', async () => {
  const app = await build(new RevocationList(), 2);

  await app.inject({ method: 'POST', url: '/api/v1/auth/otp' });
  await app.inject({ method: 'POST', url: '/api/v1/auth/otp' });
  const auth = await app.inject({ method: 'POST', url: '/api/v1/auth/otp' });
  const other = await app.inject({ method: 'GET', url: '/api/v1/catalog/x' });

  expect(auth.statusCode).toBe(429);
  expect(other.statusCode).toBe(503);
});
