import { Loader2 } from 'lucide-react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { PATHS } from '../paths';
import { useSession } from '@hanu/web-kit';

/** Guards every staff page: waits for the first refresh, then lets a signed-in user through. */
export function RequireSession() {
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
    return <Navigate to={`${PATHS.login}?next=${next}`} replace />;
  }
  return <Outlet />;
}
