import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  count?: number;
  actions?: ReactNode;
}

/** "Sectors 142" with the page's main actions on the right. */
export function PageHeader({ title, count, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-semibold tracking-tight">
        {title}
        {count !== undefined && <span className="ml-2 font-normal text-zinc-400">{count}</span>}
      </h1>
      {actions !== undefined && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
