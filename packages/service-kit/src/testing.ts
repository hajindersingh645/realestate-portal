import { generateKeyPairSync, type KeyObject } from 'node:crypto';
import { SignJWT } from 'jose';

export function createTestKeys(): { publicKeyPem: string; privateKey: KeyObject } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKey,
  };
}

export async function signTestToken(
  privateKey: KeyObject,
  claims: { sub: string; acc?: string; perms?: string[] },
  expiresIn = '10m',
): Promise<string> {
  return await new SignJWT({ acc: claims.acc, perms: claims.perms ?? [] })
    .setProtectedHeader({ alg: 'EdDSA' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(privateKey);
}

export const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://svc_kit_test:svc_kit_test@localhost:5433/real_estate_test';

export const TEST_RABBIT_URL = process.env.TEST_RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672';

export async function waitFor(
  check: () => boolean | Promise<boolean>,
  timeoutMs = 10_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`waitFor: condition not met within ${String(timeoutMs)} ms`);
}
