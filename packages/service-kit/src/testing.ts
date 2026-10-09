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
