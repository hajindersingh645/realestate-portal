import type { EventEnvelope, OtpRequestedPayload } from '@hanu/contracts';
import { sql, type Orm } from '@hanu/service-kit';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createIdentityOrm } from '../../orm.js';
import { OtpLimitError, requestOtp, verifyOtp } from './otp.service.js';
import { syncPermissions } from '../../permissions-sync.js';

const DB_URL =
  process.env.TEST_IDENTITY_DATABASE_URL ??
  'postgresql://svc_identity:svc_identity@localhost:5433/real_estate_test';
const CTX = { otpSecret: 'x'.repeat(32), locale: 'en-IN', producer: 'identity-service' };
const PHONE = '+919815012345';

let orm: Orm;

beforeAll(async () => {
  orm = await createIdentityOrm(DB_URL, 'identity');
  await orm.migrator.up();
  await orm.em.fork().transactional((em) => syncPermissions(em));
});

beforeEach(async () => {
  await sql(orm.em.fork(), 'truncate otp_challenges, outbox_events');
});

afterAll(async () => {
  await orm.close();
});

async function request(phone = PHONE): Promise<string> {
  const { challengeId } = await orm.em
    .fork()
    .transactional((em) => requestOtp(em, CTX, { phone, purpose: 'login' }));
  const rows = await sql<{ envelope: EventEnvelope<OtpRequestedPayload> }>(
    orm.em.fork(),
    `select envelope from outbox_events where envelope->'payload'->>'challengeId' = ?`,
    [challengeId],
  );
  return rows[0]?.envelope.payload.code ?? '';
}

async function verify(code: string, phone = PHONE) {
  return await orm.em
    .fork()
    .transactional((em) => verifyOtp(em, CTX, { phone, code, purpose: 'login' }));
}

function wrong(code: string): string {
  return code === '000000' ? '111111' : '000000';
}

test('requestOtp, for a new phone, stores only a hash and queues the code with its expiry', async () => {
  const code = await request();

  const rows = await sql<{ code_hash: string; ttl: number }>(
    orm.em.fork(),
    'select code_hash, extract(epoch from expires_at - created_at)::int as ttl from otp_challenges',
  );
  expect(code).toMatch(/^\d{6}$/);
  expect(rows).toHaveLength(1);
  expect(rows[0]?.code_hash).not.toContain(code);
  expect(rows[0]?.ttl).toBe(300);
});

test('verifyOtp, with the right code, succeeds and consumes the challenge', async () => {
  const code = await request();

  const result = await verify(code);

  expect(result.ok).toBe(true);
  expect(await verify(code)).toEqual({ ok: false });
});

test('verifyOtp, after five wrong codes, refuses the right one and locks the phone', async () => {
  const code = await request();

  for (let i = 0; i < 5; i += 1) expect(await verify(wrong(code))).toEqual({ ok: false });

  expect(await verify(code)).toEqual({ ok: false });
  await expect(request()).rejects.toBeInstanceOf(OtpLimitError);
});

test('verifyOtp, with a wrong code, records one attempt', async () => {
  const code = await request();

  await verify(wrong(code));

  const rows = await sql<{ attempts: number }>(
    orm.em.fork(),
    'select attempts from otp_challenges',
  );
  expect(rows[0]?.attempts).toBe(1);
});

test('requestOtp, for a fourth code inside the window, throws OtpLimitError and queues nothing', async () => {
  await request();
  await request();
  await request();

  await expect(request()).rejects.toBeInstanceOf(OtpLimitError);

  const events = await sql(orm.em.fork(), 'select id from outbox_events');
  expect(events).toHaveLength(3);
});

test('requestOtp, for another phone, is not limited by the first one', async () => {
  await request();
  await request();
  await request();

  await expect(request('+919815000000')).resolves.toMatch(/^\d{6}$/);
});

test('verifyOtp, with an expired code, fails', async () => {
  const code = await request();
  await sql(orm.em.fork(), `update otp_challenges set expires_at = now() - interval '1 second'`);

  expect(await verify(code)).toEqual({ ok: false });
});

test('verifyOtp, called twice at once with the right code, succeeds exactly once', async () => {
  const code = await request();

  const results = await Promise.all([verify(code), verify(code)]);

  expect(results.filter((r) => r.ok)).toHaveLength(1);
});

test('requestOtp, called four times at once, creates exactly three challenges', async () => {
  const results = await Promise.allSettled([request(), request(), request(), request()]);

  expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  const rows = await sql(orm.em.fork(), 'select id from otp_challenges');
  expect(rows).toHaveLength(3);
});
