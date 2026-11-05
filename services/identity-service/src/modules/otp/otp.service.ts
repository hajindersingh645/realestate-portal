import {
  EXCHANGES,
  ROUTING_KEYS,
  type OtpPurpose,
  type OtpRequestedPayload,
} from '@hanu/contracts';
import { AppError, outboxAdd, sql, type Em } from '@hanu/service-kit';
import { createHmac, randomInt, randomUUID } from 'node:crypto';

/** Latest version of every `otp.*` setting, as one CTE the statements below share. */
const SETTINGS = `s as (
  select distinct on (key) key, value from settings where key like 'otp.%' order by key, version desc
)`;
const setting = (key: string): string => `(select value::int from s where key = '${key}')`;

export class OtpLimitError extends AppError {
  constructor() {
    super('OTP_LIMIT', 'Too many codes requested for this number. Try again later.', 429);
  }
}

function hashCode(secret: string, phone: string, code: string): string {
  return createHmac('sha256', secret).update(`${phone}:${code}`).digest('hex');
}

export interface OtpContext {
  otpSecret: string;
  locale: string;
  producer: string;
}

/**
 * Creates a challenge and queues `otp.requested` (notification sends the SMS). Refused with
 * OtpLimitError when the phone is locked or has `otp.maxResends` codes in the resend window.
 * Must run inside a transaction: the per-phone lock makes concurrent requests count correctly.
 */
export async function requestOtp(
  em: Em,
  ctx: OtpContext,
  input: { phone: string; purpose: OtpPurpose; userId?: string },
): Promise<{ challengeId: string }> {
  const challengeId = randomUUID();
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');

  await sql(em, 'select pg_advisory_xact_lock(hashtext(?))', [input.phone]);
  const rows = await sql<{ expires_at: string }>(
    em,
    `with ${SETTINGS}
     insert into otp_challenges (id, phone, purpose, code_hash, expires_at, user_id, created_at)
     select ?, ?, ?, ?, now() + make_interval(secs => ${setting('otp.ttlSeconds')}), ?, now()
     where not exists (select 1 from otp_challenges where phone = ? and locked_until > now())
       and (select count(*) from otp_challenges
             where phone = ? and purpose = ?
               and created_at > now() - make_interval(mins => ${setting('otp.resendWindowMinutes')}))
           < ${setting('otp.maxResends')}
     returning expires_at`,
    [
      challengeId,
      input.phone,
      input.purpose,
      hashCode(ctx.otpSecret, input.phone, code),
      input.userId ?? null,
      input.phone,
      input.phone,
      input.purpose,
    ],
  );
  const created = rows[0];
  if (created === undefined) throw new OtpLimitError();

  const payload: OtpRequestedPayload = {
    challengeId,
    phone: input.phone,
    code,
    purpose: input.purpose,
    expiresAt: new Date(created.expires_at).toISOString(),
    locale: ctx.locale,
  };
  await outboxAdd(em, {
    exchange: EXCHANGES.identity,
    routingKey: ROUTING_KEYS.otpRequested,
    producer: ctx.producer,
    payload,
  });
  return { challengeId };
}

export type VerifyResult = { ok: true; challengeId: string; userId: string | null } | { ok: false };

/**
 * Checks the code against the newest live challenge for the phone in one statement: a wrong
 * code counts an attempt (and locks the phone at `otp.maxAttempts`), a right one consumes it.
 * Returns instead of throwing, so the caller can commit the attempt count before refusing.
 * Hashes are compared in SQL; they are HMACs, so timing reveals nothing about the code.
 */
export async function verifyOtp(
  em: Em,
  ctx: Pick<OtpContext, 'otpSecret'>,
  input: { phone: string; code: string; purpose: OtpPurpose },
): Promise<VerifyResult> {
  const hash = hashCode(ctx.otpSecret, input.phone, input.code);
  const rows = await sql<{ id: string; user_id: string | null; ok: boolean }>(
    em,
    `with ${SETTINGS},
     c as (
       select id from otp_challenges
        where phone = ? and purpose = ?
          and consumed_at is null and expires_at > now()
          and attempts < ${setting('otp.maxAttempts')}
          and not exists (select 1 from otp_challenges where phone = ? and locked_until > now())
        order by created_at desc limit 1
        for update
     )
     update otp_challenges o set
       attempts = o.attempts + case when o.code_hash = ? then 0 else 1 end,
       consumed_at = case when o.code_hash = ? then now() end,
       locked_until = case
         when o.code_hash <> ? and o.attempts + 1 >= ${setting('otp.maxAttempts')}
         then now() + make_interval(mins => ${setting('otp.lockMinutes')})
       end
     from c where o.id = c.id and o.consumed_at is null
     returning o.id, o.user_id, o.consumed_at is not null as ok`,
    [input.phone, input.purpose, input.phone, hash, hash, hash],
  );
  const row = rows[0];
  return row?.ok === true ? { ok: true, challengeId: row.id, userId: row.user_id } : { ok: false };
}
