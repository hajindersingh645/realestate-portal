import { NavLink } from 'react-router';
import { useVisibleNav } from './nav';

export interface NavLinksProps {
  /** Called after a link is followed (closes the phone drawer). */
  onNavigate?: () => void;
}

export function NavLinks({ onNavigate }: NavLinksProps) {
  const groups = useVisibleNav();
  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      {groups.map((g) => (
        <div key={g.group}>
          <p className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            {g.group}
          </p>
          <ul className="flex flex-col gap-0.5">
            {g.items.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors ${isActive ? 'bg-white font-medium text-zinc-900 shadow-sm ring-1 ring-zinc-200' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        aria-hidden="true"
                        className={`size-4 ${isActive ? 'text-accent' : 'text-zinc-400'}`}
                      />
                      {item.label}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
