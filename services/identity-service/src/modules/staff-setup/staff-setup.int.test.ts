import { ConflictError, sql, type Actor, type Orm } from '@hanu/service-kit';
import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createIdentityOrm } from '../../orm.js';
import { createRole } from '../access/roles.service.js';
import {
  completeSetup,
  createStaff,
  issueSetupLink,
  SetupLinkInvalidError,
} from './staff-setup.service.js';

const DB_URL =
  process.env.TEST_IDENTITY_DATABASE_URL ??
  'postgresql://svc_identity:svc_identity@localhost:5433/real_estate_test';
const DEPS = { country: 'IN', adminUrl: 'http://admin.test' };

let orm: Orm;
let admin: Actor;
let seq = 0;

beforeAll(async () => {
  orm = await createIdentityOrm(DB_URL, 'identity');
  await orm.migrator.up();
});

beforeEach(async () => {
  const em = orm.em.fork();
  await sql(em, 'truncate users, sessions, outbox_events, staff_setup_links cascade');
  await sql(
    em,
    `delete from role_permissions where role_id in (select id from roles where not is_system)`,
  );
  await sql(em, `delete from roles where not is_system`);
  admin = { service: 'identity-service', userId: randomUUID(), ip: '127.0.0.1' };
});

afterAll(async () => {
  await orm.close();
});

async function role(): Promise<string> {
  seq += 1;
  const created = await createRole(orm.em.fork(), admin, {
    key: `editor_${String(seq)}`,
    name: 'Editor',
    permissions: ['admin.catalog.manage'],
  });
  return created.id;
}

function staffInput(roleIds: string[]) {
  seq += 1;
  return {
    name: 'Priya Staff',
    email: `staff${String(seq)}@hanu.test`,
    phone: `98150${String(seq).padStart(5, '0')}`,
    roleIds,
  };
}

function tokenOf(setupUrl: string): string {
  return new URL(setupUrl).searchParams.get('token') ?? '';
}

test('createStaff, with two roles, creates a staff user without a password, grants both roles and returns a link that expires in 72 hours', async () => {
  const roles = [await role(), await role()];

  const result = await createStaff(orm.em.fork(), admin, DEPS, staffInput(roles));

  const [user] = await sql<{ registered_as: string; password_hash: string | null }>(
    orm.em.fork(),
    'select registered_as, password_hash from users where id = ?',
    [result.userId],
  );
  expect(user).toEqual({ registered_as: 'staff', password_hash: null });
  const granted = await sql(orm.em.fork(), 'select 1 from user_roles where user_id = ?', [
    result.userId,
  ]);
  expect(granted).toHaveLength(2);
  expect(result.setupUrl).toMatch(/^http:\/\/admin\.test\/setup\?token=[\w-]{43}$/);
  const hours = (new Date(result.expiresAt).getTime() - Date.now()) / 3_600_000;
  expect(hours).toBeGreaterThan(71.9);
  expect(hours).toBeLessThanOrEqual(72);
});

test('createStaff, when the phone already exists, throws 409 and creates nothing', async () => {
  const roles = [await role()];
  const input = staffInput(roles);
  await createStaff(orm.em.fork(), admin, DEPS, input);

  const again = createStaff(orm.em.fork(), admin, DEPS, { ...input, email: 'other@hanu.test' });

  await expect(again).rejects.toBeInstanceOf(ConflictError);
  const users = await sql(orm.em.fork(), 'select 1 from users');
  expect(users).toHaveLength(1);
});

test('completeSetup, with a fresh token, stores an argon2id hash that verifies, closes the link and revokes existing sessions', async () => {
  const { userId, setupUrl } = await createStaff(
    orm.em.fork(),
    admin,
    DEPS,
    staffInput([await role()]),
  );
  await sql(
    orm.em.fork(),
    `insert into sessions (id, user_id, refresh_token_hash, expires_at, created_at)
     values (?, ?, 'h', now() + interval '1 day', now())`,
    [randomUUID(), userId],
  );

  await completeSetup(orm.em.fork(), admin, tokenOf(setupUrl), 'a long enough password');

  const [user] = await sql<{ password_hash: string }>(
    orm.em.fork(),
    'select password_hash from users where id = ?',
    [userId],
  );
  expect(user?.password_hash.startsWith('$argon2id$')).toBe(true);
  expect(await argon2.verify(user?.password_hash ?? '', 'a long enough password')).toBe(true);
  const open = await sql(orm.em.fork(), 'select 1 from staff_setup_links where closed_at is null');
  expect(open).toHaveLength(0);
  const live = await sql(orm.em.fork(), 'select 1 from sessions where revoked_at is null');
  expect(live).toHaveLength(0);
});

test('completeSetup, when it succeeds, queues user.access.changed so the gateway refuses access tokens issued before it', async () => {
  const { userId, setupUrl } = await createStaff(
    orm.em.fork(),
    admin,
    DEPS,
    staffInput([await role()]),
  );
  const count = async (): Promise<number> =>
    (
      await sql(
        orm.em.fork(),
        `select 1 from outbox_events
          where routing_key = 'user.access.changed' and envelope->'payload'->>'userId' = ?`,
        [userId],
      )
    ).length;
  const before = await count();

  await completeSetup(orm.em.fork(), admin, tokenOf(setupUrl), 'a long enough password');

  expect(await count()).toBe(before + 1);
});

test('completeSetup, with the same token twice, fails the second time with SETUP_LINK_INVALID', async () => {
  const { setupUrl } = await createStaff(orm.em.fork(), admin, DEPS, staffInput([await role()]));
  await completeSetup(orm.em.fork(), admin, tokenOf(setupUrl), 'a long enough password');

  const again = completeSetup(orm.em.fork(), admin, tokenOf(setupUrl), 'another long password');

  await expect(again).rejects.toBeInstanceOf(SetupLinkInvalidError);
});

test('completeSetup, with an expired token, fails with SETUP_LINK_INVALID', async () => {
  const { setupUrl } = await createStaff(orm.em.fork(), admin, DEPS, staffInput([await role()]));
  await sql(orm.em.fork(), `update staff_setup_links set expires_at = now() - interval '1 minute'`);

  const attempt = completeSetup(orm.em.fork(), admin, tokenOf(setupUrl), 'a long enough password');

  await expect(attempt).rejects.toBeInstanceOf(SetupLinkInvalidError);
});

test('issueSetupLink, when an open link exists, closes it so the old token fails and the new one works', async () => {
  const { userId, setupUrl: first } = await createStaff(
    orm.em.fork(),
    admin,
    DEPS,
    staffInput([await role()]),
  );

  const { setupUrl: second } = await issueSetupLink(orm.em.fork(), admin, DEPS, userId);

  await expect(
    completeSetup(orm.em.fork(), admin, tokenOf(first), 'a long enough password'),
  ).rejects.toBeInstanceOf(SetupLinkInvalidError);
  await completeSetup(orm.em.fork(), admin, tokenOf(second), 'a long enough password');
});

test('createStaff and completeSetup each add one audit.recorded row (staff.created, staff.password_set) whose envelope contains no token', async () => {
  const { setupUrl } = await createStaff(orm.em.fork(), admin, DEPS, staffInput([await role()]));
  await completeSetup(orm.em.fork(), admin, tokenOf(setupUrl), 'a long enough password');

  const rows = await sql<{ action: string; envelope: string }>(
    orm.em.fork(),
    `select envelope->'payload'->>'action' as action, envelope::text as envelope
       from outbox_events where routing_key = 'audit.recorded'
        and envelope->'payload'->>'action' like 'staff.%' order by created_at`,
  );
  expect(rows.map((r) => r.action)).toEqual(['staff.created', 'staff.password_set']);
  for (const row of rows) expect(row.envelope).not.toContain(tokenOf(setupUrl));
});
