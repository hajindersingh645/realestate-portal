import { NavLink } from 'react-router';
import { useVisibleModules } from './modules';

export interface NavLinksProps {
  /** Called after a link is followed (closes the phone drawer). */
  onNavigate?: () => void;
}

export function NavLinks({ onNavigate }: NavLinksProps) {
  const modules = useVisibleModules();
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {modules.map((m) => (
        <NavLink
          key={m.path}
          to={m.path}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm font-medium lg:py-2 ${
              isActive ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:bg-zinc-100'
            }`
          }
        >
          <m.icon aria-hidden="true" className="size-4" />
          {m.label}
        </NavLink>
      ))}
    </nav>
  );
}
