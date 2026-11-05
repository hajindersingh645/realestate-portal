import type { ReactNode } from 'react';

export interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/** The centred card used by the sign-in and password pages. */
export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-lg bg-zinc-900 text-base font-bold text-white"
          >
            H
          </span>
          <span className="font-semibold">Hanu Admin</span>
        </div>
        <h1 className="text-lg font-semibold">{title}</h1>
        {subtitle !== undefined && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
