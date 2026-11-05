import { Brand, Toaster, UserMenu, useSession } from '@hanu/web-kit';
import { BriefcaseBusiness, UserRound, type LucideIcon } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { useMe } from '../api';
import { PATHS } from '../paths';

interface Module {
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

/** The frame around every signed-in page. Laptop first; the phone drawer comes in Task 11. */
export function AppShell() {
  const perms = useSession((s) => s.perms);
  const me = useMe();
  const modules = MODULES.filter((m) => m.visible({ perms, registeredAs: me.data?.registeredAs }));
  return (
    <div className="min-h-screen bg-white">
      <aside className="fixed inset-y-0 left-0 flex w-64 flex-col justify-between border-r border-zinc-200 bg-zinc-50 p-4">
        <div className="flex flex-col gap-6">
          <Brand app="Dashboard" />
          <nav aria-label="Main" className="flex flex-col gap-0.5">
            {modules.map((m) => (
              <NavLink
                key={m.path}
                to={m.path}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium ${
                    isActive
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'text-zinc-600 hover:bg-zinc-100'
                  }`
                }
              >
                <m.icon aria-hidden="true" className="size-4" />
                {m.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <UserMenu signInPath={PATHS.signIn} />
      </aside>
      <main className="ml-64 px-8 py-6">
        <Outlet />
      </main>
      <Toaster />
    </div>
  );
}
