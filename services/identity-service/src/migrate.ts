import { config } from './config.js';
import { createIdentityOrm } from './orm.js';
import { syncPermissions } from './permissions-sync.js';

// Migrations run as the schema owner; the service itself runs as the runtime role.
if (config.migrationDatabaseUrl === undefined) {
  throw new Error('MIGRATION_DATABASE_URL is required to run migrations');
}
const orm = await createIdentityOrm(config.migrationDatabaseUrl, config.dbSchema);
await orm.migrator.up();
const synced = await orm.em.fork().transactional((em) => syncPermissions(em));
await orm.close();
process.stdout.write(
  `identity-service: migrations applied, permissions ${JSON.stringify(synced)}\n`,
);
