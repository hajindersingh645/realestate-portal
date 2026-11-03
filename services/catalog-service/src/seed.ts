import { config } from './config.js';
import { createCatalogOrm } from './orm.js';
import { runSeed } from './seed/run-seed.js';

const orm = await createCatalogOrm(config.databaseUrl, config.dbSchema);
const result = await orm.em.fork().transactional((em) => runSeed(em, config.serviceName));
await orm.close();
process.stdout.write(`catalog-service: seed inserted ${JSON.stringify(result)}\n`);
