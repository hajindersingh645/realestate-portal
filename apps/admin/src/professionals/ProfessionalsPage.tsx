import { ACCOUNT_TYPES } from '@hanu/contracts';
import { Button, DataList, EmptyState, FilterTabs, PageHeader, SearchInput } from '@hanu/web-kit';
import { Link, useSearchParams } from 'react-router';
import { formatDateTime } from '../access/access-api';
import { PATHS } from '../paths';
import { AccountStatusBadge } from './AccountStatusBadge';
import { useAccounts, type AccountRow } from './professionals-api';

const TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'banned', label: 'Banned' },
  { value: 'all', label: 'All' },
];

/** The review queue (Pending first) and every other account, newest first. */
export function ProfessionalsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'pending';
  const filter = new URLSearchParams();
  if (status !== 'all') filter.set('status', status);
  for (const key of ['type', 'q']) {
    const value = params.get(key);
    if (value !== null && value !== '') filter.set(key, value);
  }
  const list = useAccounts(filter);
  const rows = list.data?.pages.flatMap((p) => p.data);

  const name = (a: AccountRow) => (
    <Link to={PATHS.professional(a.id)} className="font-medium hover:text-accent">
      {a.displayName}
    </Link>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Professionals" />
      <FilterTabs label="Status" param="status" tabs={TABS} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput label="Search by name or address" />
        <label className="flex items-center text-sm">
          <span className="sr-only">Type</span>
          <select
            value={params.get('type') ?? ''}
            onChange={(e) => {
              const value = e.target.value;
              setParams((prev) => {
                const next = new URLSearchParams(prev);
                if (value === '') next.delete('type');
                else next.set('type', value);
                return next;
              });
            }}
            className="h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-sm capitalize outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            <option value="">All types</option>
            {ACCOUNT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
      </div>
      <DataList
        caption="Professionals"
        rows={rows}
        rowKey={(a) => a.id}
        loading={list.isPending}
        error={list.error}
        onRetry={() => void list.refetch()}
        empty={
          <EmptyState title="No professionals here" description="Try another tab or search." />
        }
        columns={[
          { header: 'Name', cell: name },
          { header: 'Type', cell: (a) => <span className="capitalize">{a.type}</span> },
          {
            header: 'Owner',
            cell: (a) => (
              <span>
                {a.owner.name} · <span className="tabular-nums">{a.owner.phone}</span>
              </span>
            ),
          },
          { header: 'Status', cell: (a) => <AccountStatusBadge status={a.status} /> },
          {
            header: 'Created',
            cell: (a) => <span className="text-zinc-500">{formatDateTime(a.createdAt)}</span>,
          },
        ]}
        card={(a) => (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              {name(a)}
              <p className="text-xs text-zinc-500">
                {a.owner.name} · <span className="tabular-nums">{a.owner.phone}</span>
              </p>
            </div>
            <AccountStatusBadge status={a.status} />
          </div>
        )}
      />
      {list.hasNextPage ? (
        <Button
          variant="secondary"
          className="self-center"
          loading={list.isFetchingNextPage}
          onClick={() => void list.fetchNextPage()}
        >
          Load more
        </Button>
      ) : null}
    </div>
  );
}
