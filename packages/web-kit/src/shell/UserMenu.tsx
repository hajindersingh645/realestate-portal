import { useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router';
import { api } from '../api/client';
import { useSession } from '../session/session-store';

export interface UserMenuProps {
  /** Where Sign out lands. */
  signInPath: string;
}

/** The signed-in user, pinned to the bottom of the sidebar, with Sign out. */
export function UserMenu({ signInPath }: UserMenuProps) {
  const user = useSession((s) => s.user);
  const signOut = useSession((s) => s.signOut);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function onSignOut() {
    // Best effort: the session ends in this tab even if the server cannot be reached.
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    queryClient.clear(); // nothing from this user's lists stays in memory for the next one
    void navigate(signInPath, { replace: true });
    signOut();
  }

  const initials = (user?.name ?? '?')
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex items-center gap-2.5 border-t border-zinc-200 pt-4">
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700"
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user?.name}</p>
        <p className="truncate text-xs text-zinc-500">{user?.email ?? user?.phone}</p>
      </div>
      <button
        type="button"
        aria-label="Sign out"
        title="Sign out"
        onClick={() => {
          void onSignOut();
        }}
        className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900"
      >
        <LogOut aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
