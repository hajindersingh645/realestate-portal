import { Loader2 } from 'lucide-react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useSession } from '../session/session-store';

export interface RequireSessionProps {
  /** The sign-in page; the current path is passed as `?next=`. */
  signInPath: string;
}

/** Guards signed-in pages: waits for the first refresh, then lets a signed-in user through. */
export function RequireSession({ signInPath }: RequireSessionProps) {
  const status = useSession((s) => s.status);
  const location = useLocation();
  if (status === 'unknown') {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        role="status"
        aria-label="Loading"
      >
        <Loader2 aria-hidden="true" className="size-6 animate-spin text-zinc-400" />
      </div>
    );
  }
  if (status === 'signed-out') {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`${signInPath}?next=${next}`} replace />;
  }
  return <Outlet />;
}
