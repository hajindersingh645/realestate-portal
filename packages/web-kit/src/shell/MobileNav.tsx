import { Menu } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Dialog } from '../ui/Dialog';
import { Brand } from './Brand';
import { UserMenu } from './UserMenu';

export interface MobileNavProps {
  /** The app's name under the logo. */
  app: string;
  signInPath: string;
  /** The app's links. Call `close` after a link is followed, so the drawer shuts. */
  children: (close: () => void) => ReactNode;
}

/** The top bar below `lg`, with ☰ opening the app's links and the user menu as a drawer. */
export function MobileNav({ app, signInPath, children }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
  };
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-zinc-200 bg-white px-4 lg:hidden">
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => {
          setOpen(true);
        }}
        className="-ml-1.5 rounded-md p-2 text-zinc-600 hover:bg-zinc-100"
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>
      <Brand app={app} />
      <Dialog open={open} variant="drawer" title="Menu" onClose={close}>
        <div className="flex min-h-full flex-col justify-between gap-6">
          {children(close)}
          <UserMenu signInPath={signInPath} />
        </div>
      </Dialog>
    </header>
  );
}
