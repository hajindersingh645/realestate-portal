import { EXCHANGES } from '@hanu/contracts';
import { AppError, audit, sql, withDbErrors, type Em } from '@hanu/service-kit';
import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { phoneOrThrow, type AuthDeps, type Client } from '../auth/index.js';
import { requestOtp, verifyOtp } from '../otp/index.js';
import { openSession, type SessionTokens } from '../sessions/index.js';

/** Checked when the email is unknown, so both failures take about as long. Matches nothing. */
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$4e+Hwk78kp/HHD8hpzWfIA$gai2VKfYToa0lp2JA+0ipgfztBujAzMs59OVNTL/qDE';

export const MIN_PASSWORD_LENGTH = 12;

export class InvalidCredentialsError extends AppError {
  constructor() {
    super('INVALID_CREDENTIALS', 'Wrong email or password', 401);
  }
}

/**
 * Step 1 of staff login: email and password. On success a code goes to the staff phone and the
 * challenge id comes back. Unknown email and wrong password give the same error.
 */
export async function startStaffLogin(
  em: Em,
  deps: AuthDeps,
  input: { email: string; password: string },
): Promise<{ challengeId: string }> {
  const rows = await sql<{ id: string; phone: string; password_hash: string }>(
    em,
    `select id, phone, password_hash from users
      where lower(email) = lower(?) and registered_as = 'staff' and deleted_at is null`,
    [input.email.trim()],
  );
  const user = rows[0];
  const matches = await argon2.verify(user?.password_hash ?? DUMMY_HASH, input.password);
  if (user === undefined || !matches) throw new InvalidCredentialsError();
  return await em.transactional((tx) =>
    requestOtp(tx, deps.otp, { phone: user.phone, purpose: 'staff_login', userId: user.id }),
  );
}

export type StaffVerifyResult = { ok: true; tokens: SessionTokens } | { ok: false };

/** Step 2: the code for that challenge. Only a `staff_login` challenge counts. */
export async function verifyStaffLogin(
  em: Em,
  deps: AuthDeps,
  input: { challengeId: string; code: string },
  client: Client,
): Promise<StaffVerifyResult> {
  return await em.transactional(async (tx) => {
    const rows = await sql<{ phone: string }>(
      tx,
      `select phone from otp_challenges where id = ? and purpose = 'staff_login'`,
      [input.challengeId],
    );
    const phone = rows[0]?.phone;
    if (phone === undefined) return { ok: false };
    const verified = await verifyOtp(tx, deps.otp, {
      phone,
      code: input.code,
      purpose: 'staff_login',
    });
    if (!verified.ok || verified.challengeId !== input.challengeId || verified.userId === null) {
      return { ok: false };
    }
    return { ok: true, tokens: await openSession(tx, deps.signingKey, verified.userId, client) };
  });
}

/** The first super admin of an environment (`pnpm --filter identity-service create-admin`). */
export async function createSuperAdmin(
  em: Em,
  deps: Pick<AuthDeps, 'country'>,
  input: { phone: string; email: string; name: string; password: string },
): Promise<string> {
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(
      'WEAK_PASSWORD',
      `Password must be at least ${String(MIN_PASSWORD_LENGTH)} characters`,
      400,
    );
  }
  const phone = phoneOrThrow(input.phone, deps.country);
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  const id = randomUUID();
  await em.transactional(async (tx) => {
    await withDbErrors(
      () =>
        sql(
          tx,
          `insert into users (id, registered_as, name, phone, email, password_hash, created_at, updated_at)
           values (?, 'staff', ?, ?, ?, ?, now(), now())`,
          [id, input.name.trim(), phone, input.email.trim(), passwordHash],
        ),
      { unique: 'A user with this phone or email already exists' },
    );
    await sql(
      tx,
      `insert into user_roles (user_id, role_id, granted_at) select ?, id, now() from roles where key = 'super_admin'`,
      [id],
    );
    await audit(
      tx,
      EXCHANGES.identity,
      { service: 'identity-cli', userId: null, ip: null },
      {
        action: 'user.created',
        targetType: 'user',
        targetId: id,
        diff: { after: { role: 'super_admin' } },
      },
    );
  });
  return id;
}
