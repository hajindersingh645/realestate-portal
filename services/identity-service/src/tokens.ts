import { createHash, createPrivateKey, randomBytes, type KeyObject } from 'node:crypto';
import { SignJWT } from 'jose';

/** Fixed, not a setting: the gateway revocation list keeps entries for exactly this long. */
export const ACCESS_TOKEN_TTL_SECONDS = 600;

export function loadSigningKey(privateKeyPem: string): KeyObject {
  return createPrivateKey(privateKeyPem);
}

/** EdDSA access token with `sub` and `perms`. Verified by every service through the kit's `registerAuth`. */
export async function signAccessToken(
  key: KeyObject,
  userId: string,
  perms: readonly string[],
): Promise<string> {
  return await new SignJWT({ perms: [...perms] })
    .setProtectedHeader({ alg: 'EdDSA' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${String(ACCESS_TOKEN_TTL_SECONDS)}s`)
    .sign(key);
}

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

/**
 * Refresh token `<sessionId>.<secret>`. Only the hash of the secret is stored, so a database
 * leak does not hand out sessions. The session id lets reuse of an old token be detected.
 */
export function newRefreshToken(sessionId: string): { token: string; hash: string } {
  const secret = randomBytes(32).toString('base64url');
  return { token: `${sessionId}.${secret}`, hash: hashSecret(secret) };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function parseRefreshToken(token: string): { sessionId: string; hash: string } | null {
  const dot = token.indexOf('.');
  const sessionId = token.slice(0, dot);
  const secret = token.slice(dot + 1);
  if (dot < 0 || !UUID.test(sessionId) || secret.length === 0) return null;
  return { sessionId, hash: hashSecret(secret) };
}
