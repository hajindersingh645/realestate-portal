import { parseArgs } from 'node:util';
import { config } from './config.js';
import { createSuperAdmin } from './modules/staff-auth/index.js';
import { createIdentityOrm } from './orm.js';

// Usage: pnpm --filter identity-service create-admin --phone 9815012345 \
//          --email admin@hanu.property --name "Site Admin"
// It asks for the password twice (hidden). Scripts can pipe it on stdin instead.
const { values } = parseArgs({
  options: { phone: { type: 'string' }, email: { type: 'string' }, name: { type: 'string' } },
});
const { phone, email, name } = values;
if (phone === undefined || email === undefined || name === undefined) {
  process.stderr.write('Usage: create-admin --phone <mobile> --email <email> --name <name>\n');
  process.exit(1);
}

/**
 * Reads one line from the terminal without echoing it. A `data` listener, not `for await`:
 * leaving a `for await` loop closes stdin, and the second prompt would then fail.
 */
async function askHidden(question: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const input = process.stdin;
    let typed = '';
    const onData = (chunk: Buffer): void => {
      // Pasting wraps the text in bracketed-paste markers; they are not part of the password.
      const text = chunk.toString().replaceAll('\u001b[200~', '').replaceAll('\u001b[201~', '');
      for (const char of text) {
        if (char === '\u0003') process.exit(130); // Ctrl-C
        if (char === '\r' || char === '\n') {
          input.off('data', onData);
          input.off('error', reject);
          input.setRawMode(false);
          input.pause();
          process.stdout.write('\n');
          resolve(typed);
          return;
        }
        if (char === '\u007f' || char === '\b')
          typed = typed.slice(0, -1); // backspace
        else if (char >= ' ') typed += char; // other control characters are ignored
      }
    };
    process.stdout.write(question);
    input.setRawMode(true);
    input.on('data', onData);
    input.once('error', reject);
    input.resume();
  });
}

async function readPassword(): Promise<string> {
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks)
      .toString()
      .replace(/\r?\n$/, '');
  }
  const first = await askHidden('Password (12+ characters): ');
  const second = await askHidden('Password again: ');
  if (first !== second) {
    process.stderr.write('identity-service: the passwords do not match\n');
    process.exit(1);
  }
  return first;
}

const password = await readPassword();

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
