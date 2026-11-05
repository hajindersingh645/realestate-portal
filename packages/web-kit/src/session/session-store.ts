import { decodeJwt } from 'jose';
import { create } from 'zustand';

export interface SessionUser {
  id: string;
  name: string;
  phone: string;
  email: string | null;
}

/** The body of `/auth/staff/verify` and `/auth/refresh`. */
export interface SessionTokens {
  accessToken: string;
  user: SessionUser;
}

interface SessionState {
  /** In memory only: never written to localStorage, so page script cannot leak it after a reload. */
  accessToken: string | null;
  user: SessionUser | null;
  perms: string[];
  /** `unknown` until the first refresh attempt answers. */
  status: 'unknown' | 'signed-in' | 'signed-out';
  signIn: (tokens: SessionTokens) => void;
  signOut: () => void;
}

/** Permissions come from the token's `perms` claim. The browser decodes it; the services verify it. */
function permsOf(accessToken: string): string[] {
  const { perms } = decodeJwt(accessToken);
  return Array.isArray(perms) ? perms.filter((p): p is string => typeof p === 'string') : [];
}

export const useSession = create<SessionState>()((set) => ({
  accessToken: null,
  user: null,
  perms: [],
  status: 'unknown',
  signIn: (tokens) => {
    set({
      accessToken: tokens.accessToken,
      user: tokens.user,
      perms: permsOf(tokens.accessToken),
      status: 'signed-in',
    });
  },
  signOut: () => {
    set({ accessToken: null, user: null, perms: [], status: 'signed-out' });
  },
}));
