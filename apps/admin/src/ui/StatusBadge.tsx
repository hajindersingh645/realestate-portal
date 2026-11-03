import type { ReactNode } from 'react';

export interface StatusBadgeProps {
  tone: 'neutral' | 'success' | 'warning' | 'danger';
  children: ReactNode;
}

const TONES = new Map<StatusBadgeProps['tone'], string>([
  ['neutral', 'border-zinc-300 text-zinc-500'],
  ['success', 'border-emerald-300 text-emerald-700'],
  ['warning', 'border-amber-300 text-amber-700'],
  ['danger', 'border-red-300 text-red-700'],
]);

/** A small outlined capsule: ACTIVE, INACTIVE, SUSPENDED. */
export function StatusBadge({ tone, children }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${TONES.get(tone) ?? ''}`}
    >
      {children}
    </span>
  );
}
