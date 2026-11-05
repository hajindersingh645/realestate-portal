import { useSyncExternalStore } from 'react';

const QUERY = '(min-width: 768px)';

function subscribe(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const list = window.matchMedia(QUERY);
  list.addEventListener('change', onChange);
  return () => {
    list.removeEventListener('change', onChange);
  };
}

/** True at tablet width and up. Without `matchMedia` (tests) it reports wide. */
export function useIsWide(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => typeof window.matchMedia !== 'function' || window.matchMedia(QUERY).matches,
  );
}
