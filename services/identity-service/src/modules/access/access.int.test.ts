import {
  ConflictError,
  NotFoundError,
  sql,
  ValidationError,
  type Actor,
  type Em,
  type Orm,
} from '@hanu/service-kit';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createIdentityOrm } from '../../orm.js';
import { getUserDetail, setUserStatus } from '../users/admin-users.service.js';
import { SelfChangeError } from './access-changed.js';
import { effectivePermissions } from './effective-permissions.js';
import { grantRole, removeOverride, revokeRole, setOverride } from './grants.service.js';
import { createRole, deleteRole, updateRole } from './roles.service.js';
import { syncPermissions } from '../../permissions-sync.js';

const DB_URL =
  process.env.TEST_IDENTITY_DATABASE_URL ??
  'postgresql://svc_identity:svc_identity@localhost:5433/real_estate_test';

let orm: Orm;
let admin: Actor;

beforeAll(async () => {
  orm = await createIdentityOrm(DB_URL, 'identity');
  await orm.migrator.up();
  await orm.em.fork().transactional((em) => syncPermissions(em));
});

beforeEach(async () => {
  const em = orm.em.fork();
  await sql(em, 'truncate users, sessions, outbox_events cascade');
  await sql(
    em,
    `delete from role_permissions where role_id in (select id from roles where not is_system)`,
  );
  await sql(em, `delete from roles where not is_system`);
  admin = { service: 'identity-service', userId: await newUser(), ip: '127.0.0.1' };
});

afterAll(async () => {
  await orm.close();
});

let phoneSeq = 0;
async function newUser(em: Em = orm.em.fork()): Promise<string> {
  const id = randomUUID();
  phoneSeq += 1;
  await sql(
    em,
    `insert into users (id, registered_as, name, phone, created_at, updated_at)
     values (?, 'buyer', 'Test', ?, now(), now())`,
    [id, `+9198150${String(phoneSeq).padStart(5, '0')}`],
  );
  return id;
}

async function events(key = 'user.access.changed'): Promise<string[]> {
  const rows = await sql<{ user_id: string }>(
    orm.em.fork(),
    `select envelope->'payload'->>'userId' as user_id from outbox_events where routing_key = ? order by user_id`,
    [key],
  );
  return rows.map((r) => r.user_id);
}

async function staffRole(permissions = ['admin.catalog.manage']) {
  return await createRole(orm.em.fork(), admin, {
    key: `editor_${String(phoneSeq)}`,
    name: 'Editor',
    permissions,
  });
}

test('grantRole, for a staff role, adds its permissions, queues one access change and an audit entry', async () => {
  const userId = await newUser();
  const role = await staffRole();

  await grantRole(orm.em.fork(), admin, userId, role.id);

  expect(await effectivePermissions(orm.em.fork(), userId)).toEqual(['admin.catalog.manage']);
  expect(await events()).toEqual([userId]);
  expect(await events('audit.recorded')).toHaveLength(2); // role.created, user.role.granted
});

test('grantRole, for a role the user already holds, changes nothing and queues nothing', async () => {
  const userId = await newUser();
  const role = await staffRole();
  await grantRole(orm.em.fork(), admin, userId, role.id);

  await grantRole(orm.em.fork(), admin, userId, role.id);

  expect(await events()).toEqual([userId]);
});

test('grantRole, for an unknown role, throws NotFoundError', async () => {
  await expect(
    grantRole(orm.em.fork(), admin, await newUser(), randomUUID()),
  ).rejects.toBeInstanceOf(NotFoundError);
});

test('revokeRole, for a held role, removes its permissions', async () => {
  const userId = await newUser();
  const role = await staffRole();
  await grantRole(orm.em.fork(), admin, userId, role.id);

  await revokeRole(orm.em.fork(), admin, userId, role.id);

  expect(await effectivePermissions(orm.em.fork(), userId)).toEqual([]);
});

test('setOverride deny, on a permission the role grants, removes it; removeOverride restores it', async () => {
  const userId = await newUser();
  const role = await staffRole(['admin.catalog.manage', 'admin.seo.manage']);
  await grantRole(orm.em.fork(), admin, userId, role.id);

  await setOverride(orm.em.fork(), admin, userId, 'admin.seo.manage', {
    effect: 'deny',
    reason: 'Not trained yet',
  });
  const denied = await effectivePermissions(orm.em.fork(), userId);
  await removeOverride(orm.em.fork(), admin, userId, 'admin.seo.manage');

  expect(denied).toEqual(['admin.catalog.manage']);
  expect(await effectivePermissions(orm.em.fork(), userId)).toEqual([
    'admin.catalog.manage',
    'admin.seo.manage',
  ]);
});

test('setOverride, for an unknown permission, throws ValidationError', async () => {
  await expect(
    setOverride(orm.em.fork(), admin, await newUser(), 'nope.unknown', {
      effect: 'allow',
      reason: 'Test',
    }),
  ).rejects.toBeInstanceOf(ValidationError);
});

test('updateRole permissions, for a role with two holders, queues one access change per holder', async () => {
  const [a, b] = [await newUser(), await newUser()];
  const role = await staffRole();
  await grantRole(orm.em.fork(), admin, a, role.id);
  await grantRole(orm.em.fork(), admin, b, role.id);
  await sql(orm.em.fork(), 'truncate outbox_events');

  const updated = await updateRole(orm.em.fork(), admin, role.id, {
    permissions: ['admin.seo.manage'],
  });

  expect(updated.permissions).toEqual(['admin.seo.manage']);
  expect(await events()).toEqual([a, b].sort());
});

test('updateRole name only, for any role, queues no access change', async () => {
  const role = await staffRole();

  await updateRole(orm.em.fork(), admin, role.id, { name: 'Content editor' });

  expect(await events()).toEqual([]);
});

test('createRole, with a key already used by a deleted role, throws ConflictError', async () => {
  const role = await staffRole();
  await deleteRole(orm.em.fork(), admin, role.id);

  await expect(
    createRole(orm.em.fork(), admin, { key: role.key, name: 'Again', permissions: [] }),
  ).rejects.toBeInstanceOf(ConflictError);
});

test('deleteRole, for a system role, throws ConflictError', async () => {
  const rows = await sql<{ id: string }>(orm.em.fork(), `select id from roles where key = 'buyer'`);

  await expect(deleteRole(orm.em.fork(), admin, rows[0]?.id ?? '')).rejects.toBeInstanceOf(
    ConflictError,
  );
});

test('deleteRole, for a staff role with a holder, removes its permissions from that holder', async () => {
  const userId = await newUser();
  const role = await staffRole();
  await grantRole(orm.em.fork(), admin, userId, role.id);

  await deleteRole(orm.em.fork(), admin, role.id);

  expect(await effectivePermissions(orm.em.fork(), userId)).toEqual([]);
});

test('setUserStatus suspended, for a user with sessions, revokes them and records the transition', async () => {
  const userId = await newUser();
  await sql(
    orm.em.fork(),
    `insert into sessions (id, user_id, refresh_token_hash, expires_at, created_at)
     values (?, ?, 'h', now() + interval '1 day', now())`,
    [randomUUID(), userId],
  );

  const detail = await setUserStatus(orm.em.fork(), admin, userId, {
    status: 'suspended',
    reason: 'Fake leads',
  });

  expect(detail.status).toBe('suspended');
  const live = await sql(
    orm.em.fork(),
    'select id from sessions where user_id = ? and revoked_at is null',
    [userId],
  );
  expect(live).toHaveLength(0);
  const transitions = await sql<{ from_state: string; to_state: string }>(
    orm.em.fork(),
    `select from_state, to_state from state_transitions where entity_id = ?`,
    [userId],
  );
  expect(transitions).toEqual([{ from_state: 'active', to_state: 'suspended' }]);
  expect(await events()).toEqual([userId]);
});

test('setUserStatus, to the status the user already has, records nothing', async () => {
  const userId = await newUser();

  await setUserStatus(orm.em.fork(), admin, userId, { status: 'active', reason: 'No change' });

  expect(await events()).toEqual([]);
});

test('every access change, made by an admin on their own account, throws SelfChangeError', async () => {
  const role = await staffRole();
  const self = admin.userId ?? '';
  const em = orm.em.fork();

  await expect(grantRole(em, admin, self, role.id)).rejects.toBeInstanceOf(SelfChangeError);
  await expect(revokeRole(em, admin, self, role.id)).rejects.toBeInstanceOf(SelfChangeError);
  await expect(
    setOverride(em, admin, self, 'lead.unlock', { effect: 'deny', reason: 'x' }),
  ).rejects.toBeInstanceOf(SelfChangeError);
  await expect(
    setUserStatus(em, admin, self, { status: 'banned', reason: 'x' }),
  ).rejects.toBeInstanceOf(SelfChangeError);
});

test('getUserDetail, for a user with a role and an override, lists both and the effective permissions', async () => {
  const userId = await newUser();
  const role = await staffRole();
  await grantRole(orm.em.fork(), admin, userId, role.id);
  await setOverride(orm.em.fork(), admin, userId, 'lead.unlock', {
    effect: 'allow',
    reason: 'Pilot',
  });

  const detail = await getUserDetail(orm.em.fork(), userId);

  expect(detail.roles.map((r) => r.key)).toEqual([role.key]);
  expect(detail.overrides).toEqual([
    { permission: 'lead.unlock', effect: 'allow', reason: 'Pilot' },
  ]);
  expect(detail.permissions).toEqual(['admin.catalog.manage', 'lead.unlock']);
});
