import { createCliConfig } from '@hanu/service-kit';
import { ENTITIES } from './src/orm.js';

// Used only by the MikroORM CLI (`pnpm --filter identity-service migration:create`).
export default createCliConfig({
  clientUrl: process.env.MIGRATION_DATABASE_URL ?? '',
  schema: process.env.DB_SCHEMA ?? '',
  entities: ENTITIES,
});
