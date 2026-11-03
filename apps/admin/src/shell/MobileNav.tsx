import { Menu } from 'lucide-react';
import { useState } from 'react';
import { Dialog } from '../ui/Dialog';
import { Brand } from './Brand';
import { NavLinks } from './NavLinks';
import { UserMenu } from './UserMenu';

/** The top bar on phones and tablets, with ☰ opening the menu as a drawer. */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-zinc-200 bg-white px-4 lg:hidden">
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => {
          setOpen(true);
        }}
        className="-ml-1.5 rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100"
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>
      <Brand />
      <Dialog
        open={open}
        variant="drawer"
        title="Menu"
        onClose={() => {
          setOpen(false);
        }}
      >
        <div className="flex min-h-full flex-col justify-between gap-6">
          <NavLinks
            onNavigate={() => {
              setOpen(false);
            }}
          />
          <UserMenu />
        </div>
      </Dialog>
    </header>
  );
}
