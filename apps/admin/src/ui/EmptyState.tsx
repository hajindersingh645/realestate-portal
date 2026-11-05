import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-200 px-4 py-14 text-center">
      <p className="font-medium text-zinc-800">{title}</p>
      {description !== undefined && <p className="max-w-sm text-sm text-zinc-500">{description}</p>}
      {action !== undefined && <div className="mt-2">{action}</div>}
    </div>
  );
}
