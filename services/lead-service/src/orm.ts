import { createOrm, type Orm } from '@hanu/service-kit';
import { Migration20261105110000_init } from '../migrations/Migration20261105110000_init.js';
import { Migration20261105112501_lead_schema } from '../migrations/Migration20261105112501_lead_schema.js';
import {
  BuyerContact,
  LeadUnlock,
  Requirement,
  RequirementLocation,
} from './modules/requirements/index.js';

/** Every entity of this service. Used by the running service and by the migration CLI. */
export const ENTITIES = [Requirement, RequirementLocation, LeadUnlock, BuyerContact];

/** Every migration, oldest first. `orm.test.ts` fails if a file in `migrations/` is missing here. */
export const MIGRATIONS = [Migration20261105110000_init, Migration20261105112501_lead_schema];

export async function createLeadOrm(clientUrl: string, schema: string): Promise<Orm> {
  return await createOrm({ clientUrl, schema, entities: ENTITIES, migrations: MIGRATIONS });
}
