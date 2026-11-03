import { parseArgs } from 'node:util';
import { config } from './config.js';
import { createSuperAdmin } from './modules/staff-auth/index.js';
import { createIdentityOrm } from './orm.js';

// Usage (password from stdin, so it stays out of shell history):
//   read -rs P && printf '%s' "$P" | pnpm --filter identity-service create-admin \
//     --phone 9815012345 --email admin@hanu.property --name "Site Admin"
const { values } = parseArgs({
  options: { phone: { type: 'string' }, email: { type: 'string' }, name: { type: 'string' } },
});
const { phone, email, name } = values;
if (phone === undefined || email === undefined || name === undefined) {
  process.stderr.write(
    'Usage: create-admin --phone <mobile> --email <email> --name <name> < password\n',
  );
  process.exit(1);
}

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
const password = Buffer.concat(chunks)
  .toString()
  .replace(/\r?\n$/, '');

const orm = await createIdentityOrm(config.databaseUrl, config.dbSchema);
try {
  const id = await createSuperAdmin(orm.em.fork(), config.platform, {
    phone,
    email,
    name,
    password,
  });
  process.stdout.write(`identity-service: super admin created (${id})\n`);
} catch (error: unknown) {
  process.stderr.write(
    `identity-service: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
} finally {
  await orm.close();
}
