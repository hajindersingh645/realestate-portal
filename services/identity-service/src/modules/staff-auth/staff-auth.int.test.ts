import type { EventEnvelope, OtpRequestedPayload } from '@hanu/contracts';
import { AppError, ConflictError, sql, type Orm } from '@hanu/service-kit';
import { createTestKeys } from '@hanu/service-kit/testing';
import { decodeJwt } from 'jose';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createIdentityOrm } from '../../orm.js';
import type { AuthDeps } from '../auth/index.js';
import { requestOtp } from '../otp/index.js';
import {
  createSuperAdmin,
  InvalidCredentialsError,
  startStaffLogin,
  verifyStaffLogin,
} from './staff-auth.service.js';

const DB_URL =
  process.env.TEST_IDENTITY_DATABASE_URL ??
  'postgresql://svc_identity:svc_identity@localhost:5433/real_estate_test';
const deps: AuthDeps = {
  otp: { otpSecret: 'x'.repeat(32), locale: 'en-IN', producer: 'identity-service' },
  signingKey: createTestKeys().privateKey,
  country: 'IN',
  serviceName: 'identity-service',
};
const client = { ip: '127.0.0.1' };
const ADMIN = {
  phone: '9815012345',
  email: 'Admin@Hanu.property',
  name: 'Site Admin',
  password: 'correct horse battery',
};

let orm: Orm;

beforeAll(async () => {
  orm = await createIdentityOrm(DB_URL, 'identity');
  await orm.migrator.up();
});

beforeEach(async () => {
  await sql(orm.em.fork(), 'truncate users, otp_challenges, sessions, outbox_events cascade');
});

afterAll(async () => {
  await orm.close();
});

async function lastOtp(): Promise<OtpRequestedPayload | undefined> {
  const rows = await sql<{ envelope: EventEnvelope<OtpRequestedPayload> }>(
    orm.em.fork(),
    `select envelope from outbox_events where routing_key = 'otp.requested' order by created_at desc limit 1`,
  );
  return rows[0]?.envelope.payload;
}

test('createSuperAdmin, for a new email and phone, creates a staff user with super_admin', async () => {
  await createSuperAdmin(orm.em.fork(), deps, ADMIN);

  const rows = await sql<{ registered_as: string; role: string; hash: string }>(
    orm.em.fork(),
    `select u.registered_as, r.key as role, u.password_hash as hash
       from users u join user_roles ur on ur.user_id = u.id join roles r on r.id = ur.role_id`,
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ registered_as: 'staff', role: 'super_admin' });
  expect(rows[0]?.hash).toMatch(/^\$argon2id\$/);
});

test('createSuperAdmin, run a second time with the same email, throws ConflictError', async () => {
  await createSuperAdmin(orm.em.fork(), deps, ADMIN);

  await expect(
    createSuperAdmin(orm.em.fork(), deps, {
      ...ADMIN,
      phone: '9815000000',
      email: 'admin@hanu.property',
    }),
  ).rejects.toBeInstanceOf(ConflictError);
});

test('createSuperAdmin, with a password under 12 characters, throws and creates nothing', async () => {
  await expect(
    createSuperAdmin(orm.em.fork(), deps, { ...ADMIN, password: 'short' }),
  ).rejects.toBeInstanceOf(AppError);

  expect(await sql(orm.em.fork(), 'select id from users')).toHaveLength(0);
});

test('startStaffLogin, with a wrong password or an unknown email, throws the same error and sends no code', async () => {
  await createSuperAdmin(orm.em.fork(), deps, ADMIN);

  const wrong = startStaffLogin(orm.em.fork(), deps, { email: ADMIN.email, password: 'nope' });
  const unknown = startStaffLogin(orm.em.fork(), deps, {
    email: 'who@hanu.property',
    password: 'nope',
  });

  await expect(wrong).rejects.toBeInstanceOf(InvalidCredentialsError);
  await expect(unknown).rejects.toBeInstanceOf(InvalidCredentialsError);
  expect(await lastOtp()).toBeUndefined();
});

test('startStaffLogin then verifyStaffLogin, with the right password and code, returns a super admin token', async () => {
  await createSuperAdmin(orm.em.fork(), deps, ADMIN);

  const { challengeId } = await startStaffLogin(orm.em.fork(), deps, {
    email: 'admin@hanu.property',
    password: ADMIN.password,
  });
  const otp = await lastOtp();
  const result = await verifyStaffLogin(
    orm.em.fork(),
    deps,
    { challengeId, code: otp?.code ?? '' },
    client,
  );

  expect(otp?.purpose).toBe('staff_login');
  expect(otp?.phone).toBe('+919815012345');
  if (!result.ok) throw new Error('verify failed');
  const perms = decodeJwt(result.tokens.accessToken).perms as string[];
  expect(perms).toContain('admin.access.manage');
});

test('verifyStaffLogin, with a buyer login challenge and its code, fails', async () => {
  const { challengeId } = await orm.em
    .fork()
    .transactional((tx) => requestOtp(tx, deps.otp, { phone: '+919815012345', purpose: 'login' }));
  const otp = await lastOtp();

  const result = await verifyStaffLogin(
    orm.em.fork(),
    deps,
    { challengeId, code: otp?.code ?? '' },
    client,
  );

  expect(result).toEqual({ ok: false });
});
