import { createOrm, type Orm } from '@hanu/service-kit';
import { Migration20261009000000_init } from '../migrations/Migration20261009000000_init.js';
import { Migration20261103123109_add_lookups } from '../migrations/Migration20261103123109_add_lookups.js';
import { Migration20261103123301_add_property_types } from '../migrations/Migration20261103123301_add_property_types.js';
import { Migration20261103123443_add_locations } from '../migrations/Migration20261103123443_add_locations.js';
import { Migration20261103123652_add_unit_conversions } from '../migrations/Migration20261103123652_add_unit_conversions.js';
import { DemoPing } from './modules/demo/demo-ping.entity.js';
import { Location } from './modules/locations/index.js';
import { Lookup } from './modules/lookups/index.js';
import { PropertyType } from './modules/property-types/index.js';
import { UnitConversion } from './modules/unit-conversions/index.js';

/** Every entity of this service. Used by the running service and by the migration CLI. */
export const ENTITIES = [DemoPing, Lookup, PropertyType, Location, UnitConversion];

/** Every migration, oldest first. `orm.test.ts` fails if a file in `migrations/` is missing here. */
export const MIGRATIONS = [
  Migration20261009000000_init,
  Migration20261103123109_add_lookups,
  Migration20261103123301_add_property_types,
  Migration20261103123443_add_locations,
  Migration20261103123652_add_unit_conversions,
];

export async function createCatalogOrm(clientUrl: string, schema: string): Promise<Orm> {
  return await createOrm({ clientUrl, schema, entities: ENTITIES, migrations: MIGRATIONS });
}
