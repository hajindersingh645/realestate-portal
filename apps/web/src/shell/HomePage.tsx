import { Loader2 } from 'lucide-react';
import { Navigate } from 'react-router';
import { useMe } from '../api';
import { PATHS } from '../paths';
import { useMyAccount } from '../professional/account-api';

/** No home screen of its own yet: professionals go to their profile, everyone else to My profile. */
export function HomePage() {
  const me = useMe();
  const account = useMyAccount();
  if (me.isPending || account.isPending) {
    return <Loader2 aria-label="Loading" className="size-5 animate-spin text-zinc-400" />;
  }
  const professional =
    me.data?.registeredAs === 'professional' ||
    (account.data !== null && account.data !== undefined);
  return <Navigate to={professional ? PATHS.professional : PATHS.me} replace />;
}
