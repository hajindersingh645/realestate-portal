import { config } from './config.js';
import { createCatalogOrm } from './orm.js';

const orm = await createCatalogOrm(config.databaseUrl, config.dbSchema);
await orm.migrator.up();
await orm.close();
process.stdout.write('catalog-service: migrations applied\n');
