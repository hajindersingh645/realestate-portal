import { Brand, MobileNav, Toaster, UserMenu } from '@hanu/web-kit';
import { Outlet } from 'react-router';
import { PATHS } from '../paths';
import { NavLinks } from './NavLinks';

/** The frame around every signed-in page: sidebar on a laptop, top bar and drawer on a phone. */
export function AppShell() {
  return (
    <div className="min-h-screen bg-white">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col justify-between border-r border-zinc-200 bg-zinc-50 p-4 lg:flex">
        <div className="flex flex-col gap-6">
          <Brand app="Dashboard" />
          <NavLinks />
        </div>
        <UserMenu signInPath={PATHS.signIn} />
      </aside>
      <MobileNav app="Dashboard" signInPath={PATHS.signIn}>
        {(close) => <NavLinks onNavigate={close} />}
      </MobileNav>
      <main className="px-4 py-6 sm:px-6 lg:ml-64 lg:px-8">
        <Outlet />
      </main>
      <Toaster />
    </div>
  );
}
