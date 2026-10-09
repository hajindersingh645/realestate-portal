import { createPrivateKey } from 'node:crypto';
import { SignJWT } from 'jose';

// Usage: pnpm dev:token admin.catalog.manage lead.unlock
const pem = process.env.JWT_PRIVATE_KEY?.replaceAll('\\n', '\n');
if (pem === undefined) throw new Error('JWT_PRIVATE_KEY is not set; run `pnpm gen:keys >> .env`');

const token = await new SignJWT({ perms: process.argv.slice(2) })
  .setProtectedHeader({ alg: 'EdDSA' })
  .setSubject('00000000-0000-4000-8000-000000000001')
  .setIssuedAt()
  .setExpirationTime('10m')
  .sign(createPrivateKey(pem));

process.stdout.write(`${token}\n`);
