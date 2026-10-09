import { generateKeyPairSync } from 'node:crypto';

// Prints two .env lines. Development only; production keys come from the secret store.
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const line = (name: string, pem: string): string => `${name}="${pem.replaceAll('\n', '\\n')}"\n`;

process.stdout.write(
  line('JWT_PUBLIC_KEY', publicKey.export({ type: 'spki', format: 'pem' }).toString()),
);
process.stdout.write(
  line('JWT_PRIVATE_KEY', privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()),
);
