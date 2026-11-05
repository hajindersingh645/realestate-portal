import { createOrm, type Orm } from '@hanu/service-kit';
import { Migration20261103140000_init } from '../migrations/Migration20261103140000_init.js';
import { Migration20261103143222_add_identity_schema } from '../migrations/Migration20261103143222_add_identity_schema.js';
import { Migration20261103164706_staff_setup } from '../migrations/Migration20261103164706_staff_setup.js';
import { Migration20261105070709_professional_accounts } from '../migrations/Migration20261105070709_professional_accounts.js';
import { Migration20261105120000_account_review_indexes } from '../migrations/Migration20261105120000_account_review_indexes.js';
import {
  Permission,
  Role,
  RolePermission,
  UserPermissionOverride,
  UserRole,
} from './modules/access/index.js';
import {
  Account,
  AccountLocation,
  AccountMember,
  AccountTransition,
} from './modules/accounts/index.js';
import { AuditLog } from './modules/audit-logs/index.js';
import { OtpChallenge } from './modules/otp/index.js';
import { Session } from './modules/sessions/index.js';
import { StaffSetupLink } from './modules/staff-setup/index.js';
import { User } from './modules/users/index.js';

/** Every entity of this service. Used by the running service and by the migration CLI. */
export const ENTITIES = [
  Account,
  AccountMember,
  AccountLocation,
  AccountTransition,
  User,
  OtpChallenge,
  Session,
  Role,
  Permission,
  RolePermission,
  UserRole,
  UserPermissionOverride,
  AuditLog,
  StaffSetupLink,
];

/** Every migration, oldest first. `orm.test.ts` fails if a file in `migrations/` is missing here. */
export const MIGRATIONS = [
  Migration20261103140000_init,
  Migration20261103143222_add_identity_schema,
  Migration20261103164706_staff_setup,
  Migration20261105070709_professional_accounts,
  Migration20261105120000_account_review_indexes,
];

export async function createIdentityOrm(clientUrl: string, schema: string): Promise<Orm> {
  return await createOrm({ clientUrl, schema, entities: ENTITIES, migrations: MIGRATIONS });
}
