import { useSession } from '@hanu/web-kit';
import { BriefcaseBusiness, UserRound, type LucideIcon } from 'lucide-react';
import { useMe } from '../api';
import { PATHS } from '../paths';

export interface Module {
  label: string;
  path: string;
  icon: LucideIcon;
  /** Shown when this is true for the signed-in user. */
  visible: (user: { perms: string[]; registeredAs: string | undefined }) => boolean;
}

/** Every module of the dashboard. Phase 3 adds Requirements, Leads, Listings here. */
const MODULES: Module[] = [
  { label: 'My profile', path: PATHS.me, icon: UserRound, visible: () => true },
  {
    label: 'Professional profile',
    path: PATHS.professional,
    icon: BriefcaseBusiness,
    // Before the account exists there is no `profile.manage` yet, only the side chosen at sign-up.
    visible: ({ perms, registeredAs }) =>
      perms.includes('profile.manage') || registeredAs === 'professional',
  },
];

export function useVisibleModules(): Module[] {
  const perms = useSession((s) => s.perms);
  const me = useMe();
  return MODULES.filter((m) => m.visible({ perms, registeredAs: me.data?.registeredAs }));
}
