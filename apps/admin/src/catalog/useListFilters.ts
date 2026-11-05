import { useSearchParams } from 'react-router';

/** Applies the URL's `q` (search) and, when `isActive` is given, `status` to a loaded list. */
export function useListFilters<T>(
  rows: T[] | undefined,
  text: (row: T) => string,
  isActive?: (row: T) => boolean,
): T[] | undefined {
  const [params] = useSearchParams();
  const q = (params.get('q') ?? '').toLowerCase();
  const status = params.get('status');
  return rows?.filter(
    (row) =>
      (q === '' || text(row).toLowerCase().includes(q)) &&
      (status === null || isActive === undefined || (status === 'active') === isActive(row)),
  );
}
