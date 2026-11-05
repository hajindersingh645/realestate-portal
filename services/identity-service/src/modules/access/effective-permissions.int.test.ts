import { sql, type Em, type Orm } from '@hanu/service-kit';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { createIdentityOrm } from '../../orm.js';
import { effectivePermissions } from './effective-permissions.js';

const DB_URL =
  process.env.TEST_IDENTITY_DATABASE_URL ??
  'postgresql://svc_identity:svc_identity@localhost:5433/real_estate_test';

let orm: Orm;

beforeAll(async () => {
  orm = await createIdentityOrm(DB_URL, 'identity');
  await orm.migrator.up();
});

afterAll(async () => {
  await orm.close();
});

async function newUser(em: Em): Promise<string> {
  const id = randomUUID();
  const phone = `+91${String(Math.floor(6_000_000_000 + Math.random() * 3_999_999_999))}`;
  await sql(
    em,
    `insert into users (id, registered_as, name, phone, created_at, updated_at)
     values (?, 'buyer', 'Test', ?, now(), now())`,
    [id, phone],
  );
  return id;
}

async function grantRole(em: Em, userId: string, keys: string[], deleted = false): Promise<void> {
  const roleId = randomUUID();
  await sql(
    em,
    `insert into roles (id, key, name, created_at, updated_at, deleted_at)
     values (?, ?, 'Test role', now(), now(), ?)`,
    [roleId, `test_${roleId}`, deleted ? new Date() : null],
  );
  for (const key of keys) {
    await sql(em, 'insert into role_permissions (role_id, permission_key) values (?, ?)', [
      roleId,
      key,
    ]);
  }
  await sql(em, 'insert into user_roles (user_id, role_id, granted_at) values (?, ?, now())', [
    userId,
    roleId,
  ]);
}

async function override(
  em: Em,
  userId: string,
  key: string,
  effect: 'allow' | 'deny',
): Promise<void> {
  await sql(
    em,
    `insert into user_permission_overrides (user_id, permission_key, effect, reason, created_at)
     values (?, ?, ?, 'test', now())`,
    [userId, key, effect],
  );
}

test('effectivePermissions, with a role granting two keys and a deny on one, returns the other', async () => {
  const em = orm.em.fork();
  const userId = await newUser(em);
  await grantRole(em, userId, ['review.create', 'report.create']);
  await override(em, userId, 'report.create', 'deny');

  const perms = await effectivePermissions(em, userId);

  expect(perms).toEqual(['review.create']);
});

test('effectivePermissions, with an allow override and no role, returns that key', async () => {
  const em = orm.em.fork();
  const userId = await newUser(em);
  await override(em, userId, 'lead.unlock', 'allow');

  expect(await effectivePermissions(em, userId)).toEqual(['lead.unlock']);
});

test('effectivePermissions, with two roles sharing a key, returns it once, sorted', async () => {
  const em = orm.em.fork();
  const userId = await newUser(em);
  await grantRole(em, userId, ['review.create', 'billing.purchase']);
  await grantRole(em, userId, ['billing.purchase']);

  expect(await effectivePermissions(em, userId)).toEqual(['billing.purchase', 'review.create']);
});

test('effectivePermissions, from a soft-deleted role, returns nothing', async () => {
  const em = orm.em.fork();
  const userId = await newUser(em);
  await grantRole(em, userId, ['review.create'], true);

  expect(await effectivePermissions(em, userId)).toEqual([]);
});
