import { createOrm, type Orm } from '@hanu/service-kit';
import { Migration20261103150000_init } from '../migrations/Migration20261103150000_init.js';
import { Migration20261103160313_add_notification_schema } from '../migrations/Migration20261103160313_add_notification_schema.js';
import { Notification } from './modules/delivery/index.js';
import { Recipient } from './modules/recipients/index.js';
import { Template } from './modules/templates/index.js';

/** Every entity of this service. Used by the running service and by the migration CLI. */
export const ENTITIES = [Template, Recipient, Notification];

/** Every migration, oldest first. `orm.test.ts` fails if a file in `migrations/` is missing here. */
export const MIGRATIONS = [
  Migration20261103150000_init,
  Migration20261103160313_add_notification_schema,
];

export async function createNotificationOrm(clientUrl: string, schema: string): Promise<Orm> {
  return await createOrm({ clientUrl, schema, entities: ENTITIES, migrations: MIGRATIONS });
}
