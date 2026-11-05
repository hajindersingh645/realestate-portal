import { ACCOUNT_TYPES } from '@hanu/contracts';
import { Button, DataList, EmptyState, FilterTabs, PageHeader, SearchInput } from '@hanu/web-kit';
import { Link, useSearchParams } from 'react-router';
import { formatDateTime } from '../access/access-api';
import { PATHS } from '../paths';
import { AccountStatusBadge } from './AccountStatusBadge';
import {
  useAccountCounts,
  useAccounts,
  type AccountCounts,
  type AccountRow,
} from './professionals-api';

const TABS: { value: keyof AccountCounts; label: string; empty: string }[] = [
  { value: 'pending', label: 'Pending', empty: 'Nothing waiting for review' },
  { value: 'approved', label: 'Approved', empty: 'No approved professionals yet' },
  { value: 'rejected', label: 'Rejected', empty: 'No rejected profiles' },
  { value: 'suspended', label: 'Suspended', empty: 'No suspended profiles' },
  { value: 'banned', label: 'Banned', empty: 'No banned profiles' },
  { value: 'all', label: 'All', empty: 'No professionals yet' },
];

/**
 * Every account, newest first, one tab per status with its count. Opens on Pending while
 * anything waits for review, otherwise on Approved.
 */
export function ProfessionalsPage() {
  const [params, setParams] = useSearchParams();
  const narrow = new URLSearchParams();
  for (const key of ['type', 'q']) {
    const value = params.get(key);
    if (value !== null && value !== '') narrow.set(key, value);
  }
  const counts = useAccountCounts(narrow);
  const opening = counts.data === undefined || counts.data.pending > 0 ? 'pending' : 'approved';
  // Wait for the counts before choosing the opening tab, so the list is asked for only once.
  const chosen = params.get('status');
  const status = chosen ?? opening;
  const ready = chosen !== null || !counts.isPending;
  const filter = new URLSearchParams(narrow);
  if (status !== 'all') filter.set('status', status);
  const list = useAccounts(filter, ready);
  const searching = narrow.has('q') || narrow.has('type');
  const tab = TABS.find((t) => t.value === status);
  const rows = list.data?.pages.flatMap((p) => p.data);

  const name = (a: AccountRow) => (
    <Link to={PATHS.professional(a.id)} className="font-medium hover:text-accent">
      {a.displayName}
    </Link>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Professionals" />
      <FilterTabs
        label="Status"
        param="status"
        defaultValue={opening}
        tabs={TABS.map((t) => ({
          value: t.value,
          label: t.label,
          ...(counts.data === undefined ? {} : { count: counts.data[t.value] }),
        }))}
      />
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
        loading={!ready || list.isPending}
        error={list.error}
        onRetry={() => void list.refetch()}
        empty={
          <EmptyState
            title={searching ? 'No matches' : (tab?.empty ?? 'No professionals yet')}
            description={searching ? 'Try another search or type.' : 'Other tabs may have some.'}
          />
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
