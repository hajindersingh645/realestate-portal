import { useSearchParams } from 'react-router';

/** Active / inactive filter, kept in the URL as `?status=`. */
export function StatusFilter() {
  const [params, setParams] = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-600">
      <span className="sr-only">Status</span>
      <select
        value={params.get('status') ?? ''}
        onChange={(e) => {
          const value = e.target.value;
          setParams((prev) => {
            const next = new URLSearchParams(prev);
            if (value === '') next.delete('status');
            else next.set('status', value);
            return next;
          });
        }}
        className="h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      >
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
    </label>
  );
}
