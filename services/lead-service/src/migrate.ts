import { config } from './config.js';
import { createLeadOrm } from './orm.js';

// Migrations run as the schema owner; the service itself runs as the runtime role.
if (config.migrationDatabaseUrl === undefined) {
  throw new Error('MIGRATION_DATABASE_URL is required to run migrations');
}
const orm = await createLeadOrm(config.migrationDatabaseUrl, config.dbSchema);
await orm.migrator.up();
await orm.close();
process.stdout.write('lead-service: migrations applied\n');
