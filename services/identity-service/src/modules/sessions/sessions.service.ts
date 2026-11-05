import { AppError, sql, type Em } from '@hanu/service-kit';
import { randomUUID, type KeyObject } from 'node:crypto';
import { newRefreshToken, parseRefreshToken, signAccessToken } from '../../tokens.js';
import { effectivePermissions } from '../access/index.js';

export interface UserView {
  id: string;
  name: string;
  phone: string;
  email: string | null;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: UserView;
}

export class AccountInactiveError extends AppError {
  constructor() {
    super('ACCOUNT_INACTIVE', 'This account is suspended. Contact support.', 403);
  }
}

const REFRESH_DAYS = `(select value::int from settings where key = 'session.refreshDays'
                        order by version desc limit 1)`;

async function issue(
  em: Em,
  signingKey: KeyObject,
  user: UserView,
  refresh: { token: string; expiresAt: string },
): Promise<SessionTokens> {
  const perms = await effectivePermissions(em, user.id);
  return {
    accessToken: await signAccessToken(signingKey, user.id, perms),
    refreshToken: refresh.token,
    refreshExpiresAt: new Date(refresh.expiresAt),
    user,
  };
}

/** New session for a user who just proved who they are. Refused unless the user is active. */
export async function openSession(
  em: Em,
  signingKey: KeyObject,
  userId: string,
  client: { userAgent?: string; ip: string },
): Promise<SessionTokens> {
  const sessionId = randomUUID();
  const { token, hash } = newRefreshToken(sessionId);
  const rows = await sql<{ expires_at: string; user: UserView }>(
    em,
    `insert into sessions (id, user_id, refresh_token_hash, user_agent, ip, expires_at, created_at)
     select ?, u.id, ?, ?, ?, now() + make_interval(days => ${REFRESH_DAYS}), now()
       from users u where u.id = ? and u.status = 'active' and u.deleted_at is null
     returning expires_at,
       (select json_build_object('id', id, 'name', name, 'phone', phone, 'email', email)
          from users where id = user_id) as "user"`,
    [sessionId, hash, client.userAgent ?? null, client.ip, userId],
  );
  const row = rows[0];
  if (row === undefined) throw new AccountInactiveError();
  return await issue(em, signingKey, row.user, { token, expiresAt: row.expires_at });
}

export type RefreshResult = { ok: true; tokens: SessionTokens } | { ok: false };

/**
 * Swaps a refresh token for a new pair. The old token stops working. If the token does not
 * match (already used, so possibly stolen), or the session is expired or the user inactive,
 * the whole session is revoked. Returns instead of throwing so that revoke is committed.
 */
export async function refreshSession(
  em: Em,
  signingKey: KeyObject,
  refreshToken: string,
): Promise<RefreshResult> {
  const parsed = parseRefreshToken(refreshToken);
  if (parsed === null) return { ok: false };
  const next = newRefreshToken(parsed.sessionId);
  const rows = await sql<{
    expires_at: string;
    id: string;
    name: string;
    phone: string;
    email: string | null;
  }>(
    em,
    `update sessions s set refresh_token_hash = ?, rotated_at = now()
       from users u
      where s.id = ? and s.refresh_token_hash = ? and s.revoked_at is null and s.expires_at > now()
        and u.id = s.user_id and u.status = 'active' and u.deleted_at is null
     returning s.expires_at, u.id, u.name, u.phone, u.email`,
    [next.hash, parsed.sessionId, parsed.hash],
  );
  const row = rows[0];
  if (row === undefined) {
    await sql(em, 'update sessions set revoked_at = now() where id = ? and revoked_at is null', [
      parsed.sessionId,
    ]);
    return { ok: false };
  }
  const user = { id: row.id, name: row.name, phone: row.phone, email: row.email };
  return {
    ok: true,
    tokens: await issue(em, signingKey, user, { token: next.token, expiresAt: row.expires_at }),
  };
}

/** Ends the session the token belongs to. Unknown or already-revoked tokens are ignored. */
export async function revokeSession(em: Em, refreshToken: string): Promise<void> {
  const parsed = parseRefreshToken(refreshToken);
  if (parsed === null) return;
  await sql(
    em,
    'update sessions set revoked_at = now() where id = ? and refresh_token_hash = ? and revoked_at is null',
    [parsed.sessionId, parsed.hash],
  );
}
