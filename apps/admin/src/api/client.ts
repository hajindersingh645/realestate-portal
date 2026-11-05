import { useSession, type SessionTokens } from '../session/session-store';
import { toApiError } from './errors';

const BASE = '/api/v1';

function url(path: string): string {
  return new URL(`${BASE}${path}`, window.location.origin).toString();
}

let inFlight: Promise<boolean> | null = null;

/**
 * Gets a new access token with the refresh cookie. Concurrent callers share one request: the
 * server rotates the refresh token, and a second request with the old one counts as theft and
 * revokes the session.
 */
export function refresh(): Promise<boolean> {
  inFlight ??= (async () => {
    try {
      const response = await fetch(url('/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        useSession.getState().signOut();
        return false;
      }
      useSession.getState().signIn((await response.json()) as SessionTokens);
      return true;
    } catch {
      useSession.getState().signOut();
      return false;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Called once at start-up: a valid refresh cookie restores the session after a reload. */
export async function bootstrapSession(): Promise<void> {
  await refresh();
}

export interface ApiInit {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
}

async function send(path: string, init: ApiInit): Promise<Response> {
  const bearer = useSession.getState().accessToken;
  const headers: Record<string, string> = {};
  if (bearer !== null) headers.authorization = `Bearer ${bearer}`;
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  return await fetch(url(path), {
    method: init.method ?? 'GET',
    headers,
    credentials: 'include',
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

/**
 * Calls the gateway. On 401 it refreshes once and retries; if that fails the user is signed out.
 * `/auth/*` calls are excluded: there a 401 means a wrong password or code, not an old token.
 */
export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  let response = await send(path, init);
  if (response.status === 401 && !path.startsWith('/auth/')) {
    if (await refresh()) response = await send(path, init);
    if (response.status === 401) useSession.getState().signOut();
  }
  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
