import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { useIsWide } from './useIsWide';

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

export interface DataListProps<T> {
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  columns: Column<T>[];
  /** How one row looks as a card on a phone. */
  card: (row: T) => ReactNode;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  empty: ReactNode;
  /** Visually hidden caption, read by screen readers. */
  caption: string;
}

/** A table on wider screens and a list of cards on phones, with loading, error and empty states. */
export function DataList<T>({
  rows,
  rowKey,
  columns,
  card,
  loading,
  error,
  onRetry,
  empty,
  caption,
}: DataListProps<T>) {
  const wide = useIsWide();
  if (loading) {
    return (
      <div role="status" className="flex items-center justify-center gap-2 py-16 text-zinc-500">
        <Loader2 aria-hidden="true" className="size-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (error !== null && error !== undefined) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 py-16 text-center text-zinc-600"
      >
        <p>Could not load this list.</p>
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }
  if (rows === undefined || rows.length === 0) return <>{empty}</>;

  if (!wide) {
    return (
      <ul aria-label={caption} className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={rowKey(row)} className="rounded-xl border border-zinc-200 bg-white p-3">
            {card(row)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-zinc-200">
            {columns.map((c) => (
              <th
                key={c.header}
                scope="col"
                className={`px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-zinc-400 ${c.className ?? ''}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-zinc-100 hover:bg-zinc-50">
              {columns.map((c) => (
                <td key={c.header} className={`px-3 py-3 ${c.className ?? ''}`}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
