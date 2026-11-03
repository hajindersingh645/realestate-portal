import { createOrm, type Orm } from '@hanu/service-kit';
import { Migration20261009000000_init } from '../migrations/Migration20261009000000_init.js';
import { DemoPing } from './modules/demo/demo-ping.entity.js';

/** Every entity of this service. Used by the running service and by the migration CLI. */
export const ENTITIES = [DemoPing];

/** Every migration, oldest first. `orm.test.ts` fails if a file in `migrations/` is missing here. */
export const MIGRATIONS = [Migration20261009000000_init];

export async function createCatalogOrm(clientUrl: string, schema: string): Promise<Orm> {
  return await createOrm({ clientUrl, schema, entities: ENTITIES, migrations: MIGRATIONS });
}
