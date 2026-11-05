import type { ReactNode } from 'react';
import { SearchInput } from '@hanu/web-kit';
import { StatusFilter } from './StatusFilter';

export interface CatalogToolbarProps {
  /** Extra filters before the status filter (e.g. the parent city). */
  children?: ReactNode;
  showStatus?: boolean;
}

export function CatalogToolbar({ children, showStatus = true }: CatalogToolbarProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <SearchInput />
      {children}
      {showStatus && <StatusFilter />}
    </div>
  );
}
