import { config } from './config.js';
import { createNotificationOrm } from './orm.js';

// Migrations run as the schema owner; the service itself runs as the runtime role.
if (config.migrationDatabaseUrl === undefined) {
  throw new Error('MIGRATION_DATABASE_URL is required to run migrations');
}
const orm = await createNotificationOrm(config.migrationDatabaseUrl, config.dbSchema);
await orm.migrator.up();
await orm.close();
process.stdout.write('notification-service: migrations applied\n');
