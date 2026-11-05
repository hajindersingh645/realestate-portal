import { EXCHANGES, ROUTING_KEYS, type UserContactPayload } from '@hanu/contracts';
import {
  AppError,
  audit,
  outboxAdd,
  sql,
  ValidationError,
  withDbErrors,
  type Em,
} from '@hanu/service-kit';
import { randomUUID, type KeyObject } from 'node:crypto';
import { normalisePhone, requestOtp, verifyOtp, type OtpContext } from '../otp/index.js';
import { openSession, type SessionTokens } from '../sessions/index.js';

export interface AuthDeps {
  otp: OtpContext;
  signingKey: KeyObject;
  country: string;
  serviceName: string;
}

export interface Client {
  userAgent?: string;
  ip: string;
}

export class InvalidOtpError extends AppError {
  constructor() {
    super('INVALID_OTP', 'Wrong or expired code', 401);
  }
}

/** Asked only the first time a number logs in; ignored for a known number. */
export interface SignupDetails {
  name?: string;
  consent?: boolean;
  /** The `signup.data_notice` version (catalog content block) the user was shown. */
  noticeBlockId?: string;
  registeredAs?: 'buyer' | 'professional';
}

export class SignupDetailsRequiredError extends AppError {
  constructor() {
    super(
      'SIGNUP_DETAILS_REQUIRED',
      'New number: name, consent and the notice version are required',
      400,
    );
  }
}

export function phoneOrThrow(input: string, country: string): string {
  const phone = normalisePhone(input, country);
  if (phone === null) throw new ValidationError('Enter a valid mobile number');
  return phone;
}

/** Sends a login code. Same answer for known and unknown numbers, so it reveals nothing. */
export async function startLogin(em: Em, deps: AuthDeps, phoneInput: string): Promise<void> {
  const phone = phoneOrThrow(phoneInput, deps.country);
  await em.transactional((tx) => requestOtp(tx, deps.otp, { phone, purpose: 'login' }));
}

export type LoginResult = { ok: true; tokens: SessionTokens } | { ok: false };

/**
 * Logs in with a phone code; a number seen for the first time signs up as a buyer.
 * A wrong code returns `{ ok: false }` so its attempt is committed. Errors thrown after a right
 * code (missing signup details, suspended account) roll back, leaving the code usable.
 */
export async function login(
  em: Em,
  deps: AuthDeps,
  input: { phone: string; code: string } & SignupDetails,
  client: Client,
): Promise<LoginResult> {
  const phone = phoneOrThrow(input.phone, deps.country);
  return await em.transactional(async (tx) => {
    const verified = await verifyOtp(tx, deps.otp, { phone, code: input.code, purpose: 'login' });
    if (!verified.ok) return { ok: false };
    const existing = await sql<{ id: string }>(
      tx,
      'select id from users where phone = ? and deleted_at is null',
      [phone],
    );
    const userId = existing[0]?.id ?? (await signUp(tx, deps, phone, input, client));
    return { ok: true, tokens: await openSession(tx, deps.signingKey, userId, client) };
  });
}

async function signUp(
  em: Em,
  deps: AuthDeps,
  phone: string,
  input: SignupDetails,
  client: Client,
): Promise<string> {
  const name = input.name?.trim() ?? '';
  if (name === '' || input.consent !== true || input.noticeBlockId === undefined) {
    throw new SignupDetailsRequiredError();
  }
  const registeredAs = input.registeredAs ?? 'buyer';
  const id = randomUUID();
  await withDbErrors(
    () =>
      sql(
        em,
        `insert into users (id, registered_as, name, phone, phone_verified_at, notice_block_id, consented_at, created_at, updated_at)
         values (?, ?, ?, ?, now(), ?, now(), now(), now())`,
        [id, registeredAs, name, phone, input.noticeBlockId],
      ),
    { unique: 'This number is already registered' },
  );
  // A professional's role comes from their account (created next), not from user_roles.
  if (registeredAs === 'buyer') {
    await sql(
      em,
      `insert into user_roles (user_id, role_id, granted_at) select ?, id, now() from roles where key = 'buyer'`,
      [id],
    );
  }
  const payload: UserContactPayload = { userId: id, name, phone, email: null };
  await outboxAdd(em, {
    exchange: EXCHANGES.identity,
    routingKey: ROUTING_KEYS.userRegistered,
    producer: deps.serviceName,
    payload,
  });
  await audit(
    em,
    EXCHANGES.identity,
    { service: deps.serviceName, userId: id, ip: client.ip },
    { action: 'user.registered', targetType: 'user', targetId: id },
  );
  return id;
}
