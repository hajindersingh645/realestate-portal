import { useSession } from '@hanu/web-kit';
import { Loader2 } from 'lucide-react';
import { Navigate } from 'react-router';
import { useMe } from '../api';
import { PATHS } from '../paths';
import { useMyAccount } from '../professional/account-api';

/** No home screen of its own: professionals go to their profile, buyers to their requirements. */
export function HomePage() {
  const me = useMe();
  const perms = useSession((s) => s.perms);
  const account = useMyAccount();
  if (me.isPending || account.isPending) {
    return <Loader2 aria-label="Loading" className="size-5 animate-spin text-zinc-400" />;
  }
  const professional =
    me.data?.registeredAs === 'professional' ||
    (account.data !== null && account.data !== undefined);
  const buyer = perms.includes('requirement.manage_own');
  return (
    <Navigate
      to={professional ? PATHS.professional : buyer ? PATHS.requirements : PATHS.me}
      replace
    />
  );
}
