import type { AccountDecisionPayload, EventEnvelope } from '@hanu/contracts';
import { ConflictError, NotFoundError, sql, ValidationError, type Orm } from '@hanu/service-kit';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createIdentityOrm } from '../../orm.js';
import { syncPermissions } from '../../permissions-sync.js';
import { seedAccount, seedUser } from './accounts.fixture.js';
import {
  decideAccount,
  getAccountForStaff,
  listAccountsForStaff,
} from './account-review.service.js';

const DB_URL =
  process.env.TEST_IDENTITY_DATABASE_URL ??
  'postgresql://svc_identity:svc_identity@localhost:5433/real_estate_test';
const CITY = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c01';

let orm: Orm;
let staff: { service: string; userId: string; ip: string };

beforeAll(async () => {
  orm = await createIdentityOrm(DB_URL, 'identity');
  await orm.migrator.up();
  await orm.em.fork().transactional((em) => syncPermissions(em));
});

beforeEach(async () => {
  await sql(
    orm.em.fork(),
    `truncate account_transitions, account_locations, account_members, accounts,
              users, sessions, outbox_events cascade`,
  );
  staff = {
    service: 'identity-service',
    userId: await seedUser(orm.em.fork(), 'staff'),
    ip: '127.0.0.1',
  };
});

afterAll(async () => {
  await orm.close();
});

async function events(routingKey: string): Promise<AccountDecisionPayload[]> {
  const rows = await sql<{ envelope: EventEnvelope<AccountDecisionPayload> }>(
    orm.em.fork(),
    'select envelope from outbox_events where routing_key = ? order by created_at',
    [routingKey],
  );
  return rows.map((row) => row.envelope.payload);
}

async function statusOf(accountId: string): Promise<string | undefined> {
  const rows = await sql<{ status: string }>(
    orm.em.fork(),
    'select status from accounts where id = ?',
    [accountId],
  );
  return rows[0]?.status;
}

test('decideAccount approve, for a pending account, approves it, records who, and queues account.approved for the owner', async () => {
  const { accountId, ownerId } = await seedAccount(orm.em.fork());

  const view = await decideAccount(orm.em.fork(), staff, accountId, 'approve', undefined);

  expect(view.status).toBe('approved');
  expect(view.transitions[0]).toMatchObject({
    fromStatus: 'pending',
    toStatus: 'approved',
    reason: null,
    actorUserId: staff.userId,
  });
  expect(await events('account.approved')).toEqual([
    { accountId, ownerUserId: ownerId, status: 'approved', reason: null },
  ]);
  const access = await sql(
    orm.em.fork(),
    `select 1 from outbox_events where routing_key = 'user.access.changed'`,
  );
  expect(access).toHaveLength(1);
  const audit = await sql<{ routing_key: string }>(
    orm.em.fork(),
    `select routing_key from outbox_events where routing_key = 'audit.recorded'`,
  );
  expect(audit).toHaveLength(1);
});

test.each([
  ['approve', 'pending', 'approved', 'account.approved'],
  ['reject', 'pending', 'rejected', 'account.rejected'],
  ['suspend', 'approved', 'suspended', 'account.suspended'],
  ['ban', 'pending', 'banned', 'account.suspended'],
  ['ban', 'approved', 'banned', 'account.suspended'],
  ['ban', 'rejected', 'banned', 'account.suspended'],
  ['ban', 'suspended', 'banned', 'account.suspended'],
  ['reactivate', 'suspended', 'approved', 'account.approved'],
] as const)(
  'decideAccount %s, from %s, moves to %s and queues one %s',
  async (action, from, to, key) => {
    const { accountId } = await seedAccount(orm.em.fork(), { status: from });

    await decideAccount(orm.em.fork(), staff, accountId, action, 'Checked by phone');

    expect(await statusOf(accountId)).toBe(to);
    const sent = await events(key);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      status: to,
      reason: action === 'approve' ? null : 'Checked by phone',
    });
  },
);

test.each([
  ['approve', 'approved'],
  ['approve', 'rejected'],
  ['approve', 'banned'],
  ['reject', 'approved'],
  ['reject', 'rejected'],
  ['suspend', 'pending'],
  ['suspend', 'suspended'],
  ['ban', 'banned'],
  ['reactivate', 'banned'],
  ['reactivate', 'approved'],
] as const)(
  'decideAccount %s, from %s, throws ConflictError and changes nothing',
  async (action, from) => {
    const { accountId } = await seedAccount(orm.em.fork(), { status: from });

    await expect(
      decideAccount(orm.em.fork(), staff, accountId, action, 'Reason'),
    ).rejects.toBeInstanceOf(ConflictError);

    expect(await statusOf(accountId)).toBe(from);
    expect(await sql(orm.em.fork(), 'select 1 from outbox_events')).toHaveLength(0);
    expect(await sql(orm.em.fork(), 'select 1 from account_transitions')).toHaveLength(0);
  },
);

test.each(['reject', 'suspend', 'ban', 'reactivate'] as const)(
  'decideAccount %s, without a reason or with only spaces, throws ValidationError',
  async (action) => {
    const { accountId } = await seedAccount(orm.em.fork(), { status: 'pending' });

    await expect(
      decideAccount(orm.em.fork(), staff, accountId, action, undefined),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      decideAccount(orm.em.fork(), staff, accountId, action, '   '),
    ).rejects.toBeInstanceOf(ValidationError);
  },
);

test('decideAccount, for an unknown or deleted account, throws NotFoundError', async () => {
  const { accountId } = await seedAccount(orm.em.fork(), { deleted: true });

  await expect(
    decideAccount(orm.em.fork(), staff, accountId, 'approve', undefined),
  ).rejects.toBeInstanceOf(NotFoundError);
  await expect(
    decideAccount(
      orm.em.fork(),
      staff,
      '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c99',
      'approve',
      undefined,
    ),
  ).rejects.toBeInstanceOf(NotFoundError);
});

test('decideAccount, two decisions at the same time, exactly one wins and the other throws ConflictError', async () => {
  const { accountId } = await seedAccount(orm.em.fork());

  const results = await Promise.allSettled([
    decideAccount(orm.em.fork(), staff, accountId, 'approve', undefined),
    decideAccount(orm.em.fork(), staff, accountId, 'reject', 'Wrong licence'),
  ]);

  const failed = results.filter((r) => r.status === 'rejected');
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(failed).toHaveLength(1);
  expect(failed[0]?.status === 'rejected' && failed[0].reason).toBeInstanceOf(ConflictError);
  expect(await sql(orm.em.fork(), 'select 1 from account_transitions')).toHaveLength(1);
});

test('listAccountsForStaff, filtered by status, returns newest first with the owner and pages by cursor', async () => {
  for (let i = 0; i < 51; i += 1) await seedAccount(orm.em.fork(), { ageSeconds: i });
  await seedAccount(orm.em.fork(), { status: 'approved' });

  const first = await listAccountsForStaff(orm.em.fork(), { status: 'pending' });
  const second = await listAccountsForStaff(orm.em.fork(), {
    status: 'pending',
    cursor: first.nextCursor ?? '',
  });

  expect(first.data).toHaveLength(50);
  expect(first.data[0]).toMatchObject({ status: 'pending', owner: { name: 'Ravi' } });
  expect(first.data.map((a) => a.createdAt)).toEqual(
    first.data
      .map((a) => a.createdAt)
      .sort()
      .reverse(),
  );
  expect(second.data).toHaveLength(1);
  expect(second.nextCursor).toBeNull();
});

test('listAccountsForStaff, with q and type, matches the name or slug and the type', async () => {
  await seedAccount(orm.em.fork(), { displayName: 'Ravi Realty', slug: 'ravi-realty' });
  await seedAccount(orm.em.fork(), {
    displayName: 'Sunrise Homes',
    type: 'agency',
    slug: 'sunrise',
  });

  const byName = await listAccountsForStaff(orm.em.fork(), { q: 'REALTY' });
  const bySlug = await listAccountsForStaff(orm.em.fork(), { q: 'sunrise' });
  const byType = await listAccountsForStaff(orm.em.fork(), { type: 'agency' });
  const wild = await listAccountsForStaff(orm.em.fork(), { q: '%' });

  expect(byName.data.map((a) => a.slug)).toEqual(['ravi-realty']);
  expect(bySlug.data.map((a) => a.slug)).toEqual(['sunrise']);
  expect(byType.data.map((a) => a.slug)).toEqual(['sunrise']);
  expect(wild.data).toHaveLength(0);
});

test('listAccountsForStaff, never lists deleted accounts', async () => {
  await seedAccount(orm.em.fork(), { deleted: true });

  expect((await listAccountsForStaff(orm.em.fork(), {})).data).toHaveLength(0);
});

test('getAccountForStaff, after a rejection, shows the owner, areas and the history newest first', async () => {
  const { accountId, ownerId } = await seedAccount(orm.em.fork(), {
    areas: [{ locationId: CITY, cityId: CITY }],
  });
  await decideAccount(orm.em.fork(), staff, accountId, 'reject', 'Licence unreadable');

  const view = await getAccountForStaff(orm.em.fork(), accountId);

  expect(view).toMatchObject({
    id: accountId,
    status: 'rejected',
    owner: { userId: ownerId, name: 'Ravi' },
    areas: [{ locationId: CITY, cityId: CITY }],
  });
  expect(view.transitions.map((t) => t.toStatus)).toEqual(['rejected']);
  expect(view.transitions[0]?.reason).toBe('Licence unreadable');
});

test('getAccountForStaff, for an unknown account, throws NotFoundError', async () => {
  await expect(
    getAccountForStaff(orm.em.fork(), '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c99'),
  ).rejects.toBeInstanceOf(NotFoundError);
});
