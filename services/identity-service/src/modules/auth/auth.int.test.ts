import type { EventEnvelope, OtpRequestedPayload } from '@hanu/contracts';
import { ConflictError, sql, type Orm } from '@hanu/service-kit';
import { createTestKeys } from '@hanu/service-kit/testing';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createIdentityOrm } from '../../orm.js';
import { AccountInactiveError, refreshSession, revokeSession } from '../sessions/index.js';
import { updateMe } from '../users/users.service.js';
import { login, SignupDetailsRequiredError, startLogin, type AuthDeps } from './auth.service.js';
import { syncPermissions } from '../../permissions-sync.js';

const DB_URL =
  process.env.TEST_IDENTITY_DATABASE_URL ??
  'postgresql://svc_identity:svc_identity@localhost:5433/real_estate_test';
const deps: AuthDeps = {
  otp: { otpSecret: 'x'.repeat(32), locale: 'en-IN', producer: 'identity-service' },
  signingKey: createTestKeys().privateKey,
  country: 'IN',
  serviceName: 'identity-service',
};
const client = { ip: '127.0.0.1', userAgent: 'vitest' };
const PHONE = '98150 12345';
/** Any id: identity stores the notice version the client showed; catalog owns the text. */
const NOTICE = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c01';

let orm: Orm;

beforeAll(async () => {
  orm = await createIdentityOrm(DB_URL, 'identity');
  await orm.migrator.up();
  await orm.em.fork().transactional((em) => syncPermissions(em));
});

beforeEach(async () => {
  await sql(orm.em.fork(), 'truncate users, otp_challenges, sessions, outbox_events cascade');
});

afterAll(async () => {
  await orm.close();
});

async function sendCode(phone = PHONE): Promise<string> {
  await startLogin(orm.em.fork(), deps, phone);
  const rows = await sql<{ envelope: EventEnvelope<OtpRequestedPayload> }>(
    orm.em.fork(),
    `select envelope from outbox_events where routing_key = 'otp.requested' order by created_at desc limit 1`,
  );
  return rows[0]?.envelope.payload.code ?? '';
}

async function signUp(phone = PHONE) {
  const code = await sendCode(phone);
  const result = await login(
    orm.em.fork(),
    deps,
    { phone, code, name: 'Asha', consent: true, noticeBlockId: NOTICE },
    client,
  );
  if (!result.ok) throw new Error('signup failed');
  return result.tokens;
}

async function refresh(token: string) {
  return await orm.em.fork().transactional((tx) => refreshSession(tx, deps.signingKey, token));
}

async function routingKeys(): Promise<string[]> {
  const rows = await sql<{ routing_key: string }>(
    orm.em.fork(),
    'select routing_key from outbox_events order by created_at, routing_key',
  );
  return rows.map((r) => r.routing_key);
}

test('login, for a new number with name and consent, signs up a buyer and queues the events', async () => {
  const tokens = await signUp();

  expect(tokens.user).toMatchObject({ name: 'Asha', phone: '+919815012345', email: null });
  const rows = await sql<{ registered_as: string; consented: boolean; role: string }>(
    orm.em.fork(),
    `select u.registered_as, u.consented_at is not null as consented, r.key as role
       from users u join user_roles ur on ur.user_id = u.id join roles r on r.id = ur.role_id`,
  );
  expect(rows).toEqual([{ registered_as: 'buyer', consented: true, role: 'buyer' }]);
  expect(await routingKeys()).toEqual(
    expect.arrayContaining(['otp.requested', 'user.registered', 'audit.recorded']),
  );
});

test('login, for a known number, returns the same user and opens a second session', async () => {
  const first = await signUp();
  const code = await sendCode('+91 98150-12345');

  const second = await login(orm.em.fork(), deps, { phone: '+91 98150-12345', code }, client);

  expect(second.ok && second.tokens.user.id).toBe(first.user.id);
  expect(await sql(orm.em.fork(), 'select id from sessions')).toHaveLength(2);
});

test('login, for a new number without consent, throws and leaves the code usable', async () => {
  const code = await sendCode();

  await expect(
    login(orm.em.fork(), deps, { phone: PHONE, code, name: 'Asha' }, client),
  ).rejects.toBeInstanceOf(SignupDetailsRequiredError);

  const retry = await login(
    orm.em.fork(),
    deps,
    { phone: PHONE, code, name: 'Asha', consent: true, noticeBlockId: NOTICE },
    client,
  );
  expect(retry.ok).toBe(true);
});

test('login, for a new number as a professional, stores the side and the notice version and grants no role', async () => {
  const code = await sendCode();

  const result = await login(
    orm.em.fork(),
    deps,
    {
      phone: PHONE,
      code,
      name: 'Ravi',
      consent: true,
      noticeBlockId: NOTICE,
      registeredAs: 'professional',
    },
    client,
  );

  expect(result.ok).toBe(true);
  const [user] = await sql<{ registered_as: string; notice_block_id: string; consented: boolean }>(
    orm.em.fork(),
    'select registered_as, notice_block_id, consented_at is not null as consented from users',
  );
  expect(user).toEqual({ registered_as: 'professional', notice_block_id: NOTICE, consented: true });
  expect(await sql(orm.em.fork(), 'select 1 from user_roles')).toHaveLength(0);
});

test('login, for a new number with consent but no notice version, throws SignupDetailsRequiredError', async () => {
  const code = await sendCode();

  await expect(
    login(orm.em.fork(), deps, { phone: PHONE, code, name: 'Asha', consent: true }, client),
  ).rejects.toBeInstanceOf(SignupDetailsRequiredError);

  expect(await sql(orm.em.fork(), 'select id from users')).toHaveLength(0);
});

test('login, for a known number, ignores registeredAs and noticeBlockId', async () => {
  await signUp();
  const code = await sendCode();

  await login(
    orm.em.fork(),
    deps,
    {
      phone: PHONE,
      code,
      registeredAs: 'professional',
      noticeBlockId: '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c99',
    },
    client,
  );

  const [user] = await sql<{ registered_as: string; notice_block_id: string }>(
    orm.em.fork(),
    'select registered_as, notice_block_id from users',
  );
  expect(user).toEqual({ registered_as: 'buyer', notice_block_id: NOTICE });
});

test('login, with a wrong code, returns ok false and creates no user', async () => {
  const code = await sendCode();

  const result = await login(
    orm.em.fork(),
    deps,
    { phone: PHONE, code: code === '000000' ? '111111' : '000000', name: 'Asha', consent: true },
    client,
  );

  expect(result).toEqual({ ok: false });
  expect(await sql(orm.em.fork(), 'select id from users')).toHaveLength(0);
});

test('refreshSession, with the current token, rotates it; the old one then revokes the session', async () => {
  const tokens = await signUp();

  const rotated = await refresh(tokens.refreshToken);
  if (!rotated.ok) throw new Error('refresh failed');
  const reused = await refresh(tokens.refreshToken);
  const newer = await refresh(rotated.tokens.refreshToken);

  expect(rotated.tokens.refreshToken).not.toBe(tokens.refreshToken);
  expect(reused).toEqual({ ok: false });
  expect(newer).toEqual({ ok: false });
});

test('revokeSession, then refreshSession with the same token, is refused', async () => {
  const tokens = await signUp();

  await revokeSession(orm.em.fork(), tokens.refreshToken);

  expect(await refresh(tokens.refreshToken)).toEqual({ ok: false });
});

test('a suspended user, at login and at refresh, is refused', async () => {
  const tokens = await signUp();
  await sql(orm.em.fork(), `update users set status = 'suspended'`);
  const code = await sendCode();

  await expect(login(orm.em.fork(), deps, { phone: PHONE, code }, client)).rejects.toBeInstanceOf(
    AccountInactiveError,
  );
  expect(await refresh(tokens.refreshToken)).toEqual({ ok: false });
});

test('updateMe, with an email another user has in another case, throws ConflictError', async () => {
  const asha = await signUp();
  const ravi = await signUp('9815000000');
  await updateMe(orm.em.fork(), 'identity-service', asha.user.id, { email: 'Asha@Example.in' });

  await expect(
    updateMe(orm.em.fork(), 'identity-service', ravi.user.id, { email: 'asha@example.in' }),
  ).rejects.toBeInstanceOf(ConflictError);
});

test('updateMe, with a new name, saves it and queues user.contact.changed', async () => {
  const tokens = await signUp();

  const me = await updateMe(orm.em.fork(), 'identity-service', tokens.user.id, { name: 'Asha K' });

  expect(me.name).toBe('Asha K');
  expect(me.permissions).toContain('requirement.create');
  expect(await routingKeys()).toContain('user.contact.changed');
});
