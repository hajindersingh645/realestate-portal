import { Button, DataList, EmptyState, FilterTabs, PageHeader, SearchInput } from '@hanu/web-kit';
import { Link, useSearchParams } from 'react-router';
import { formatDateTime } from '../access/access-api';
import { PATHS } from '../paths';
import {
  useRequirementCounts,
  useRequirements,
  type RequirementCounts,
  type RequirementRow,
} from './requirements-api';
import { RequirementStatusBadge } from './RequirementStatusBadge';
import { useReferenceNames } from './useReferenceNames';

const TABS: { value: keyof RequirementCounts; label: string; empty: string }[] = [
  { value: 'pending_review', label: 'Pending', empty: 'Nothing waiting for review' },
  { value: 'live', label: 'Live', empty: 'No live requirements' },
  { value: 'pending_payment', label: 'Awaiting payment', empty: 'None awaiting payment' },
  { value: 'rejected', label: 'Rejected', empty: 'No rejected requirements' },
  { value: 'hidden', label: 'Hidden', empty: 'No hidden requirements' },
  { value: 'fake', label: 'Fake', empty: 'None marked fake' },
  { value: 'expired', label: 'Expired', empty: 'None expired' },
  { value: 'closed', label: 'Closed', empty: 'None closed' },
  { value: 'all', label: 'All', empty: 'No requirements yet' },
];

/** The moderation queue. Opens on Pending while anything waits for review, otherwise on Live. */
export function RequirementsPage() {
  const [params] = useSearchParams();
  const narrow = new URLSearchParams();
  const q = params.get('q');
  if (q !== null && q !== '') narrow.set('q', q);
  const counts = useRequirementCounts(narrow);
  const opening =
    counts.data === undefined || counts.data.pending_review > 0 ? 'pending_review' : 'live';
  // Wait for the counts before choosing the opening tab, so the list is asked for only once.
  const chosen = params.get('status');
  const status = chosen ?? opening;
  const ready = chosen !== null || !counts.isPending;
  const filter = new URLSearchParams(narrow);
  if (status !== 'all') filter.set('status', status);
  const list = useRequirements(filter, ready);
  const names = useReferenceNames();
  const tab = TABS.find((t) => t.value === status);
  const rows = list.data?.pages.flatMap((p) => p.data);

  const title = (r: RequirementRow) => (
    <Link to={PATHS.requirement(r.id)} className="font-medium hover:text-accent">
      {r.purpose === 'buy' ? 'Buy' : 'Rent'} {names.type(r.propertyTypeId)} ·{' '}
      {r.cityIds.map(names.place).join(', ')}
    </Link>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Requirements" />
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
      <SearchInput label="Search by buyer name or phone" />
      <DataList
        caption="Requirements"
        rows={rows}
        rowKey={(r) => r.id}
        loading={!ready || list.isPending}
        error={list.error}
        onRetry={() => void list.refetch()}
        empty={
          <EmptyState
            title={narrow.has('q') ? 'No matches' : (tab?.empty ?? 'No requirements yet')}
            description={narrow.has('q') ? 'Try another search.' : 'Other tabs may have some.'}
          />
        }
        columns={[
          { header: 'Requirement', cell: title },
          { header: 'Buyer', cell: (r) => r.buyerName ?? '—' },
          { header: 'Status', cell: (r) => <RequirementStatusBadge status={r.status} /> },
          {
            header: 'Submitted',
            cell: (r) => (
              <span className="text-zinc-500">{formatDateTime(r.submittedAt ?? r.createdAt)}</span>
            ),
          },
        ]}
        card={(r) => (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              {title(r)}
              <p className="text-xs text-zinc-500">{r.buyerName ?? '—'}</p>
            </div>
            <RequirementStatusBadge status={r.status} />
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
