import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { useSession } from '@hanu/web-kit';
import { useVisibleNav } from './nav';

/** Start page: a card for every section this staff member can open. Dashboards come in Phase 5. */
export function HomePage() {
  const name = useSession((s) => s.user?.name ?? '');
  const groups = useVisibleNav();
  return (
    <div className="flex max-w-5xl flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Welcome, {name}</h1>
        <p className="mt-1 text-sm text-zinc-500">Pick a section to get started.</p>
      </div>
      {groups.length === 0 && (
        <p className="rounded-xl border border-dashed border-zinc-200 p-6 text-sm text-zinc-600">
          Your account has no admin sections yet. Ask an admin to give you a role.
        </p>
      )}
      {groups.map((g) => (
        <section key={g.group} aria-labelledby={`home-${g.group}`}>
          <h2
            id={`home-${g.group}`}
            className="mb-3 text-[11px] font-medium uppercase tracking-wider text-zinc-400"
          >
            {g.group}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className="group flex items-center gap-3 rounded-xl border border-zinc-200 p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                >
                  <item.icon aria-hidden="true" className="size-5 text-accent" />
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className="block text-xs text-zinc-500">{item.description}</span>
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 text-zinc-300 group-hover:text-zinc-500"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
