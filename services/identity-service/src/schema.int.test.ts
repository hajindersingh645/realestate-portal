import { sql, type Orm } from '@hanu/service-kit';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createIdentityOrm } from './orm.js';
import { syncPermissions } from './permissions-sync.js';
import { PERMISSIONS } from '@hanu/contracts';

const OWNER_URL =
  process.env.TEST_IDENTITY_DATABASE_URL ??
  'postgresql://svc_identity:svc_identity@localhost:5433/real_estate_test';
const APP_URL =
  process.env.TEST_IDENTITY_APP_DATABASE_URL ??
  'postgresql://svc_identity_app:svc_identity_app@localhost:5433/real_estate_test';

let orm: Orm;
let appOrm: Orm;

beforeAll(async () => {
  orm = await createIdentityOrm(OWNER_URL, 'identity');
  await orm.migrator.up();
  appOrm = await createIdentityOrm(APP_URL, 'identity');
});

beforeEach(async () => {
  await sql(orm.em.fork(), 'truncate users, audit_logs cascade');
});

afterAll(async () => {
  await appOrm.close();
  await orm.close();
});

async function insertUser(
  fields: {
    phone?: string;
    email?: string | null;
    registeredAs?: string;
    passwordHash?: string | null;
    deleted?: boolean;
  } = {},
): Promise<void> {
  await sql(
    appOrm.em.fork(),
    `insert into users (id, registered_as, name, phone, email, password_hash, created_at, updated_at, deleted_at)
     values (?, ?, 'Test', ?, ?, ?, now(), now(), ?)`,
    [
      randomUUID(),
      fields.registeredAs ?? 'buyer',
      fields.phone ?? '+919815012345',
      fields.email ?? null,
      fields.passwordHash ?? null,
      fields.deleted === true ? new Date() : null,
    ],
  );
}

test('syncPermissions, when run twice, adds nothing the second time', async () => {
  await orm.em.fork().transactional((em) => syncPermissions(em));

  const second = await orm.em.fork().transactional((em) => syncPermissions(em));

  expect(second).toEqual({ added: 0, granted: 0 });
});

test('syncPermissions, after a key is removed from the table, adds it back and grants it to super_admin', async () => {
  const em = orm.em.fork();
  await sql(em, `delete from role_permissions where permission_key = 'admin.audit.view'`);
  await sql(em, `delete from permissions where key = 'admin.audit.view'`);

  const result = await orm.em.fork().transactional((tx) => syncPermissions(tx));

  expect(result).toEqual({ added: 1, granted: 1 });
});

test('the system roles, after migrating, are seeded with their starting permissions', async () => {
  const rows = await sql<{ key: string; n: string }>(
    orm.em.fork(),
    `select r.key, count(rp.permission_key) as n from roles r
     left join role_permissions rp on rp.role_id = r.id where r.is_system group by r.key order by r.key`,
  );

  expect(rows.map((r) => [r.key, Number(r.n)])).toEqual([
    ['agency_member', 6],
    ['agency_owner', 9],
    ['agent', 9],
    ['buyer', 6],
    ['consultant', 9],
    // super_admin holds every key (the permission sync grants new ones).
    ['super_admin', PERMISSIONS.length],
  ]);
});

test('users, a staff user without an email, is refused', async () => {
  await expect(insertUser({ registeredAs: 'staff' })).rejects.toThrow(/users_staff_email_check/);
});

test('users, a staff user with an email but no password yet (setup link pending), is allowed', async () => {
  await expect(insertUser({ registeredAs: 'staff', email: 'a@b.in' })).resolves.toBeUndefined();
});

test('users, a second live user with the same phone, is refused', async () => {
  await insertUser();

  await expect(insertUser()).rejects.toThrow(/users_phone_live_unique/);
});

test('users, a phone used only by a deleted user, can sign up again', async () => {
  await insertUser({ deleted: true });

  await expect(insertUser()).resolves.toBeUndefined();
});

test('users, the same email in another case, is refused', async () => {
  await insertUser({ phone: '+919815000001', email: 'Asha@Example.in' });

  await expect(insertUser({ phone: '+919815000002', email: 'asha@example.in' })).rejects.toThrow(
    /users_email_live_unique/,
  );
});

test('audit_logs, as the runtime role, can be added to but not changed or deleted', async () => {
  const em = appOrm.em.fork();
  await sql(
    em,
    `insert into audit_logs (id, event_id, service, action, target_type, target_id, created_at)
     values (?, ?, 'test', 'probe.created', 'probe', 'p1', now())`,
    [randomUUID(), randomUUID()],
  );

  await expect(sql(em, `update audit_logs set action = 'x'`)).rejects.toThrow(/permission denied/);
  await expect(sql(em, 'delete from audit_logs')).rejects.toThrow(/permission denied/);
});
