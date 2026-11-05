import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  sql,
  UpstreamError,
  ValidationError,
  type Orm,
} from '@hanu/service-kit';
import { createTestKeys } from '@hanu/service-kit/testing';
import { decodeJwt } from 'jose';
import { http, HttpResponse } from 'msw/http';
import { setupServer } from 'msw/node';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'vitest';
import { createIdentityOrm } from '../../orm.js';
import { syncPermissions } from '../../permissions-sync.js';
import { openSession } from '../sessions/index.js';
import {
  createAccount,
  getMyAccount,
  resubmitMyAccount,
  updateMyAccount,
  type AccountInput,
} from './accounts.service.js';

const DB_URL =
  process.env.TEST_IDENTITY_DATABASE_URL ??
  'postgresql://svc_identity:svc_identity@localhost:5433/real_estate_test';
const CATALOG = 'http://catalog.test';
const deps = { catalogUrl: CATALOG };
const keys = createTestKeys();

// The catalog side of `/internal/locations`, intercepted at the network layer.
const CITY = randomUUID();
const LOCALITY = randomUUID();
const STATE = randomUUID();
const INACTIVE = randomUUID();
const KNOWN = new Map<
  string,
  { id: string; type: string; cityId: string | null; isActive: boolean }
>([
  [CITY, { id: CITY, type: 'city', cityId: CITY, isActive: true }],
  [LOCALITY, { id: LOCALITY, type: 'locality', cityId: CITY, isActive: true }],
  [STATE, { id: STATE, type: 'state', cityId: null, isActive: true }],
  [INACTIVE, { id: INACTIVE, type: 'locality', cityId: CITY, isActive: false }],
]);
const catalog = setupServer(
  http.get(`${CATALOG}/internal/locations`, ({ request }) => {
    const ids = new URL(request.url).searchParams.get('ids')?.split(',') ?? [];
    return HttpResponse.json({ data: ids.flatMap((id) => KNOWN.get(id) ?? []) });
  }),
);

let orm: Orm;

beforeAll(async () => {
  catalog.listen({ onUnhandledFrame: 'error' });
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
  await sql(orm.em.fork(), `update settings set value = 'false' where key = 'license.mandatory'`);
});

afterEach(() => {
  catalog.resetHandlers();
});

afterAll(async () => {
  catalog.close();
  await orm.close();
});

async function user(registeredAs = 'professional'): Promise<string> {
  const id = randomUUID();
  await sql(
    orm.em.fork(),
    `insert into users (id, registered_as, name, phone, email, created_at, updated_at)
     values (?, ?, 'Ravi', ?, ?, now(), now())`,
    [
      id,
      registeredAs,
      `+9198${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
      registeredAs === 'staff' ? `${id}@staff.test` : null, // staff need an email (users_staff_email_check)
    ],
  );
  return id;
}

function actor(userId: string) {
  return { service: 'identity-service', userId, ip: '127.0.0.1' };
}

function input(overrides: Partial<AccountInput> = {}): AccountInput {
  return {
    type: 'agent',
    displayName: 'Ravi Realty',
    about: 'Plots and flats in Mohali',
    experienceYears: 8,
    specialisations: ['Plots', 'Resale flats'],
    licenseNumber: 'PBRERA-SAS80-PR0123',
    locationIds: [CITY, LOCALITY],
    ...overrides,
  };
}

async function setStatus(accountId: string, status: string): Promise<void> {
  await sql(orm.em.fork(), 'update accounts set status = ? where id = ?', [status, accountId]);
}

test('createAccount, for a professional with two areas, creates a pending account they own and records why', async () => {
  const userId = await user();

  const account = await createAccount(orm.em.fork(), actor(userId), deps, input());

  expect(account).toMatchObject({
    status: 'pending',
    slug: 'ravi-realty',
    type: 'agent',
    rejectReason: null,
  });
  expect(account.areas).toEqual(
    expect.arrayContaining([
      { locationId: CITY, cityId: CITY },
      { locationId: LOCALITY, cityId: CITY },
    ]),
  );
  const [member] = await sql<{ member_role: string; status: string }>(
    orm.em.fork(),
    'select member_role, status from account_members where user_id = ?',
    [userId],
  );
  expect(member).toEqual({ member_role: 'owner', status: 'active' });
  const transitions = await sql<{ from_status: string | null; to_status: string }>(
    orm.em.fork(),
    'select from_status, to_status from account_transitions',
  );
  expect(transitions).toEqual([{ from_status: null, to_status: 'pending' }]);
  const keys = await sql<{ routing_key: string; action: string | null }>(
    orm.em.fork(),
    `select routing_key, envelope->'payload'->>'action' as action from outbox_events order by routing_key`,
  );
  expect(keys).toEqual([
    { routing_key: 'audit.recorded', action: 'account.created' },
    { routing_key: 'user.access.changed', action: null },
  ]);
});

test('createAccount, then a new session, gives a token with acc, accSt pending and the agent permissions', async () => {
  const userId = await user();
  const account = await createAccount(orm.em.fork(), actor(userId), deps, input());

  const tokens = await orm.em
    .fork()
    .transactional((tx) => openSession(tx, keys.privateKey, userId, { ip: '127.0.0.1' }));

  const claims = decodeJwt(tokens.accessToken);
  expect(claims).toMatchObject({ acc: account.id, accSt: 'pending' });
  expect(claims.perms).toEqual(expect.arrayContaining(['profile.manage', 'lead.view_feed']));
});

test('createAccount, for an agency, derives agency_owner (with team.manage)', async () => {
  const userId = await user();
  await createAccount(orm.em.fork(), actor(userId), deps, input({ type: 'agency' }));

  const tokens = await orm.em
    .fork()
    .transactional((tx) => openSession(tx, keys.privateKey, userId, { ip: '127.0.0.1' }));

  expect(decodeJwt(tokens.accessToken).perms).toEqual(expect.arrayContaining(['team.manage']));
});

test('createAccount, when the user already has an account, throws ConflictError and creates nothing more', async () => {
  const userId = await user();
  await createAccount(orm.em.fork(), actor(userId), deps, input());

  await expect(
    createAccount(orm.em.fork(), actor(userId), deps, input({ displayName: 'Second' })),
  ).rejects.toBeInstanceOf(ConflictError);

  expect(await sql(orm.em.fork(), 'select id from accounts')).toHaveLength(1);
});

test('createAccount, for a staff user, throws ForbiddenError', async () => {
  const staffId = await user('staff');

  await expect(createAccount(orm.em.fork(), actor(staffId), deps, input())).rejects.toBeInstanceOf(
    ForbiddenError,
  );
});

test('createAccount, for names that slugify the same, gives ravi-realty then ravi-realty-2, and never reuses a deleted slug', async () => {
  const first = await createAccount(orm.em.fork(), actor(await user()), deps, input());
  await sql(orm.em.fork(), 'update accounts set deleted_at = now() where id = ?', [first.id]);

  const second = await createAccount(
    orm.em.fork(),
    actor(await user()),
    deps,
    input({ displayName: 'RAVI realty!' }),
  );

  expect(first.slug).toBe('ravi-realty');
  expect(second.slug).toBe('ravi-realty-2');
});

test('createAccount, for a name with no Latin letters, gets the slug pro', async () => {
  const account = await createAccount(
    orm.em.fork(),
    actor(await user()),
    deps,
    input({ displayName: 'राज प्रॉपर्टी' }),
  );

  expect(account.slug).toBe('pro');
});

test.each([
  ['an unknown id', [CITY, randomUUID()]],
  ['an inactive locality', [INACTIVE]],
  ['a state', [STATE]],
])(
  'createAccount, with %s in the areas, throws ValidationError and saves nothing',
  async (_, ids) => {
    const userId = await user();

    await expect(
      createAccount(orm.em.fork(), actor(userId), deps, input({ locationIds: ids })),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(await sql(orm.em.fork(), 'select id from accounts')).toHaveLength(0);
  },
);

test('createAccount, when catalog is down, throws UpstreamError and saves nothing', async () => {
  catalog.use(http.get(`${CATALOG}/internal/locations`, () => HttpResponse.error()));

  await expect(
    createAccount(orm.em.fork(), actor(await user()), deps, input()),
  ).rejects.toBeInstanceOf(UpstreamError);

  expect(await sql(orm.em.fork(), 'select id from accounts')).toHaveLength(0);
});

test('createAccount, when the licence is mandatory and none is given, throws ValidationError', async () => {
  await sql(orm.em.fork(), `update settings set value = 'true' where key = 'license.mandatory'`);

  await expect(
    createAccount(orm.em.fork(), actor(await user()), deps, input({ licenseNumber: undefined })),
  ).rejects.toBeInstanceOf(ValidationError);
});

test('getMyAccount, for a user without an account, throws NotFoundError', async () => {
  await expect(getMyAccount(orm.em.fork(), await user())).rejects.toBeInstanceOf(NotFoundError);
});

test('getMyAccount, after a rejection, shows the latest reason and the licence settings', async () => {
  const userId = await user();
  const account = await createAccount(orm.em.fork(), actor(userId), deps, input());
  await setStatus(account.id, 'rejected');
  await sql(
    orm.em.fork(),
    `insert into account_transitions (id, account_id, from_status, to_status, reason, created_at)
     values (gen_random_uuid(), ?, 'pending', 'rejected', 'Add your RERA number', now() + interval '1 second')`,
    [account.id],
  );

  const mine = await getMyAccount(orm.em.fork(), userId);

  expect(mine).toMatchObject({ status: 'rejected', rejectReason: 'Add your RERA number' });
  expect(mine.license).toEqual({ label: 'RERA', mandatory: false });
});

test('updateMyAccount, by another professional, changes only their own account and never the status', async () => {
  const owner = await user();
  const other = await user();
  const mine = await createAccount(orm.em.fork(), actor(owner), deps, input());
  await createAccount(orm.em.fork(), actor(other), deps, input({ displayName: 'Other' }));

  await updateMyAccount(orm.em.fork(), actor(other), deps, {
    displayName: 'Hijack',
    // A status in the body is dropped by the route schema; even if it got here it is not a field.
    ...({ status: 'approved' } as object),
  });

  const [row] = await sql<{ display_name: string; status: string }>(
    orm.em.fork(),
    'select display_name, status from accounts where id = ?',
    [mine.id],
  );
  expect(row).toEqual({ display_name: 'Ravi Realty', status: 'pending' });
  expect((await getMyAccount(orm.em.fork(), other)).status).toBe('pending');
});

test('updateMyAccount, for a user without an account, throws NotFoundError', async () => {
  await expect(
    updateMyAccount(orm.em.fork(), actor(await user()), deps, { displayName: 'x' }),
  ).rejects.toBeInstanceOf(NotFoundError);
});

test('updateMyAccount, with new areas, replaces the old ones', async () => {
  const userId = await user();
  await createAccount(orm.em.fork(), actor(userId), deps, input());

  const updated = await updateMyAccount(orm.em.fork(), actor(userId), deps, {
    locationIds: [LOCALITY],
  });

  expect(updated.areas).toEqual([{ locationId: LOCALITY, cityId: CITY }]);
});

test('updateMyAccount, changing the slug while pending, works; once approved, throws ConflictError', async () => {
  const userId = await user();
  const account = await createAccount(orm.em.fork(), actor(userId), deps, input());

  const renamed = await updateMyAccount(orm.em.fork(), actor(userId), deps, {
    slug: 'ravi-mohali',
  });
  await setStatus(account.id, 'approved');

  expect(renamed.slug).toBe('ravi-mohali');
  await expect(
    updateMyAccount(orm.em.fork(), actor(userId), deps, { slug: 'ravi-chd' }),
  ).rejects.toBeInstanceOf(ConflictError);
});

test('updateMyAccount, while approved, keeps the account approved (no re-review)', async () => {
  const userId = await user();
  const account = await createAccount(orm.em.fork(), actor(userId), deps, input());
  await setStatus(account.id, 'approved');

  const updated = await updateMyAccount(orm.em.fork(), actor(userId), deps, { about: 'New text' });

  expect(updated).toMatchObject({ status: 'approved', about: 'New text' });
});

test('updateMyAccount, while suspended or banned, throws ConflictError', async () => {
  const userId = await user();
  const account = await createAccount(orm.em.fork(), actor(userId), deps, input());
  await setStatus(account.id, 'suspended');

  await expect(
    updateMyAccount(orm.em.fork(), actor(userId), deps, { about: 'x' }),
  ).rejects.toBeInstanceOf(ConflictError);
});

test('updateMyAccount, to a slug another account uses, throws ConflictError', async () => {
  await createAccount(orm.em.fork(), actor(await user()), deps, input({ displayName: 'Taken' }));
  const userId = await user();
  await createAccount(orm.em.fork(), actor(userId), deps, input());

  await expect(
    updateMyAccount(orm.em.fork(), actor(userId), deps, { slug: 'taken' }),
  ).rejects.toBeInstanceOf(ConflictError);
});

test('resubmitMyAccount, from rejected, moves to pending and records it; from pending, throws ConflictError', async () => {
  const userId = await user();
  const account = await createAccount(orm.em.fork(), actor(userId), deps, input());

  await expect(resubmitMyAccount(orm.em.fork(), actor(userId))).rejects.toBeInstanceOf(
    ConflictError,
  );
  await setStatus(account.id, 'rejected');
  const resubmitted = await resubmitMyAccount(orm.em.fork(), actor(userId));

  expect(resubmitted.status).toBe('pending');
  const last = await sql<{ from_status: string; to_status: string }>(
    orm.em.fork(),
    'select from_status, to_status from account_transitions order by created_at desc limit 1',
  );
  expect(last).toEqual([{ from_status: 'rejected', to_status: 'pending' }]);
});
