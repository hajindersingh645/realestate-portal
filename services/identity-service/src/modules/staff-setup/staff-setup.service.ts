import { EXCHANGES } from '@hanu/contracts';
import {
  AppError,
  audit,
  NotFoundError,
  sql,
  withDbErrors,
  type Actor,
  type Em,
} from '@hanu/service-kit';
import argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { grantRole } from '../access/grants.service.js';
import { phoneOrThrow } from '../auth/index.js';

export interface StaffSetupDeps {
  country: string;
  /** Where the admin app runs; the link points at its `/setup` page. */
  adminUrl: string;
}

export interface SetupLink {
  setupUrl: string;
  expiresAt: string;
}

/** One error for unknown, used, replaced and expired links, so the answer reveals nothing. */
export class SetupLinkInvalidError extends AppError {
  constructor() {
    super('SETUP_LINK_INVALID', 'This link has expired or was already used', 400);
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Inserts a new open link for a staff user. The caller closes any earlier one first. */
async function insertLink(
  tx: Em,
  deps: StaffSetupDeps,
  createdBy: string | null,
  userId: string,
): Promise<SetupLink> {
  const token = randomBytes(32).toString('base64url');
  const rows = await sql<{ expires_at: Date }>(
    tx,
    `insert into staff_setup_links (id, user_id, token_hash, expires_at, created_by, created_at)
     select ?, u.id, ?,
            now() + make_interval(hours => (select value::int from settings
                                             where key = 'staff.setupLinkTtlHours'
                                             order by version desc limit 1)),
            ?, now()
       from users u
      where u.id = ? and u.registered_as = 'staff' and u.deleted_at is null
     returning expires_at`,
    [randomUUID(), hashToken(token), createdBy, userId],
  );
  const row = rows[0];
  if (row === undefined) throw new NotFoundError('Staff member not found');
  const setupUrl = `${deps.adminUrl.replace(/\/$/, '')}/setup?token=${token}`;
  return { setupUrl, expiresAt: new Date(row.expires_at).toISOString() };
}

export async function createStaff(
  em: Em,
  actor: Actor,
  deps: StaffSetupDeps,
  input: { name: string; email: string; phone: string; roleIds: string[] },
): Promise<SetupLink & { userId: string }> {
  const phone = phoneOrThrow(input.phone, deps.country);
  const userId = randomUUID();
  return await em.transactional(async (tx) => {
    await withDbErrors(
      () =>
        sql(
          tx,
          `insert into users (id, registered_as, name, phone, email, created_at, updated_at)
           values (?, 'staff', ?, ?, ?, now(), now())`,
          [userId, input.name.trim(), phone, input.email.trim().toLowerCase()],
        ),
      { unique: 'A user with this phone or email already exists' },
    );
    for (const roleId of input.roleIds) await grantRole(tx, actor, userId, roleId);
    const link = await insertLink(tx, deps, actor.userId, userId);
    await audit(tx, EXCHANGES.identity, actor, {
      action: 'staff.created',
      targetType: 'user',
      targetId: userId,
      diff: {
        after: {
          name: input.name.trim(),
          email: input.email.trim().toLowerCase(),
          roleIds: input.roleIds,
        },
      },
    });
    return { userId, ...link };
  });
}

/** A new link for a staff member (lost link or forgotten password). Any earlier open link stops working. */
export async function issueSetupLink(
  em: Em,
  actor: Actor,
  deps: StaffSetupDeps,
  userId: string,
): Promise<SetupLink> {
  return await em.transactional(async (tx) => {
    await sql(
      tx,
      'update staff_setup_links set closed_at = now() where user_id = ? and closed_at is null',
      [userId],
    );
    const link = await insertLink(tx, deps, actor.userId, userId);
    await audit(tx, EXCHANGES.identity, actor, {
      action: 'staff.setup_link.issued',
      targetType: 'user',
      targetId: userId,
      diff: { after: { expiresAt: link.expiresAt } },
    });
    return link;
  });
}

/** Sets the password from a link. The link closes, and every session of that user is revoked. */
export async function completeSetup(
  em: Em,
  actor: Actor,
  token: string,
  password: string,
): Promise<void> {
  // Hash before the transaction: argon2 takes ~50 ms and must not hold row locks.
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await em.transactional(async (tx) => {
    const closed = await sql<{ user_id: string }>(
      tx,
      `update staff_setup_links set closed_at = now()
        where token_hash = ? and closed_at is null and expires_at > now()
       returning user_id`,
      [hashToken(token)],
    );
    const userId = closed[0]?.user_id;
    if (userId === undefined) throw new SetupLinkInvalidError();
    await sql(tx, 'update users set password_hash = ?, updated_at = now() where id = ?', [
      passwordHash,
      userId,
    ]);
    await sql(
      tx,
      'update sessions set revoked_at = now() where user_id = ? and revoked_at is null',
      [userId],
    );
    await audit(
      tx,
      EXCHANGES.identity,
      { ...actor, userId },
      {
        action: 'staff.password_set',
        targetType: 'user',
        targetId: userId,
      },
    );
  });
}
