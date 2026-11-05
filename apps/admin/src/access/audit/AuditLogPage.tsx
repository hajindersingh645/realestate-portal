import { useInfiniteQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { api, Button, EmptyState, FormError, PageHeader, useCan } from '@hanu/web-kit';
import { PATHS } from '../../paths';
import { formatDateTime, IDENTITY } from '../access-api';
import { DiffView } from './DiffView';

interface AuditEntry {
  id: string;
  actorUserId: string | null;
  service: string;
  action: string;
  targetType: string;
  targetId: string;
  diff: unknown;
  ip: string | null;
  createdAt: string;
}

const TARGET_TYPES = [
  { value: 'user', label: 'Users' },
  { value: 'role', label: 'Roles' },
  { value: 'location', label: 'Locations' },
  { value: 'property_type', label: 'Property types' },
  { value: 'lookup', label: 'Lookups' },
  { value: 'unit_conversion', label: 'Unit conversions' },
];
const FILTERS = ['targetType', 'targetId', 'actorUserId'] as const;

export function AuditLogPage() {
  const [params, setParams] = useSearchParams();
  const canOpenUsers = useCan('admin.user.manage');
  const filter = new URLSearchParams();
  for (const key of FILTERS) {
    const value = params.get(key);
    if (value !== null && value !== '') filter.set(key, value);
  }
  const search = filter.toString();

  const log = useInfiniteQuery({
    queryKey: ['identity', 'audit-logs', search],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const query = new URLSearchParams(filter);
      if (pageParam !== null) query.set('cursor', pageParam);
      const qs = query.toString();
      return api<{ data: AuditEntry[]; nextCursor: string | null }>(
        `${IDENTITY}/audit-logs${qs === '' ? '' : `?${qs}`}`,
      );
    },
    getNextPageParam: (last) => last.nextCursor,
  });
  const entries = log.data?.pages.flatMap((p) => p.data) ?? [];

  function setFilter(key: string, value: string) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === '') next.delete(key);
      else next.set(key, value);
      return next;
    });
  }

  const actor = (e: AuditEntry) => {
    if (e.actorUserId === null) return <span className="text-zinc-500">System</span>;
    const short = `User ${e.actorUserId.slice(0, 8)}`;
    return canOpenUsers ? (
      <Link to={PATHS.user(e.actorUserId)} className="hover:text-accent">
        {short}
      </Link>
    ) : (
      short
    );
  };

  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <PageHeader title="Audit log" />
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm">
          <span className="sr-only">What changed</span>
          <select
            value={params.get('targetType') ?? ''}
            onChange={(e) => {
              setFilter('targetType', e.target.value);
            }}
            className="h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            <option value="">Everything</option>
            {TARGET_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        {(params.has('targetId') || params.has('actorUserId')) && (
          <Button
            variant="ghost"
            onClick={() => {
              setParams(
                new URLSearchParams(
                  params.has('targetType') ? { targetType: params.get('targetType') ?? '' } : {},
                ),
              );
            }}
          >
            Clear record filter
          </Button>
        )}
      </div>

      {log.isPending && <p className="py-16 text-center text-zinc-500">Loading…</p>}
      {log.error !== null && <FormError error={log.error} />}
      {!log.isPending && entries.length === 0 && log.error === null && (
        <EmptyState
          title="Nothing recorded yet"
          description="Changes appear here as staff make them."
        />
      )}

      <ul className="flex flex-col divide-y divide-zinc-100 rounded-xl border border-zinc-200">
        {entries.map((e) => (
          <li key={e.id}>
            <details className="group">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm hover:bg-zinc-50">
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 text-zinc-400 transition-transform group-open:rotate-90"
                />
                <span className="font-mono text-xs">{e.action}</span>
                <span className="text-zinc-500">{actor(e)}</span>
                <span className="text-xs text-zinc-400">{e.service}</span>
                <time dateTime={e.createdAt} className="ml-auto text-xs text-zinc-500">
                  {formatDateTime(e.createdAt)}
                </time>
              </summary>
              <div className="flex flex-col gap-2 border-t border-zinc-100 bg-zinc-50/50 px-4 py-3 sm:pl-12">
                <p className="text-xs text-zinc-500">
                  {e.targetType} <span className="font-mono">{e.targetId}</span>
                  {e.ip !== null && ` · from ${e.ip}`}
                </p>
                <DiffView diff={e.diff} />
              </div>
            </details>
          </li>
        ))}
      </ul>

      {log.hasNextPage && (
        <Button
          variant="secondary"
          className="self-center"
          loading={log.isFetchingNextPage}
          onClick={() => void log.fetchNextPage()}
        >
          Load more
        </Button>
      )}
    </div>
  );
}
