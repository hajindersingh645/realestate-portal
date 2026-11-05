import { DataList, EmptyState, PageHeader } from '@hanu/web-kit';
import { Link } from 'react-router';
import { useReference } from '../api';
import { PATHS, requirementPath } from '../paths';
import { formatMoney, useMyRequirements, type MyRequirement } from './requirements-api';
import { RequirementStatusBadge } from './RequirementStatusBadge';

const POST_LINK =
  'inline-flex items-center rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent-hover';

export function MyRequirementsPage() {
  const list = useMyRequirements();
  const reference = useReference();
  const currency = reference.data?.platform.currency ?? 'INR';
  const locale = reference.data?.platform.locale ?? 'en-IN';
  const types = new Map((reference.data?.propertyTypes ?? []).map((t) => [t.id, t.name]));
  const title = (r: MyRequirement) =>
    `${r.purpose === 'buy' ? 'Buy' : 'Rent'} ${types.get(r.propertyTypeId) ?? 'property'}`;
  const budget = (r: MyRequirement) =>
    `${formatMoney(r.budgetMin, currency, locale)} – ${formatMoney(r.budgetMax, currency, locale)}`;
  const open = (r: MyRequirement) => (
    <Link to={requirementPath(r.id)} className="font-medium text-zinc-900 hover:underline">
      {title(r)}
    </Link>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My requirements"
        actions={
          <Link to={PATHS.newRequirement} className={POST_LINK}>
            Post a requirement
          </Link>
        }
      />
      <DataList
        caption="My requirements"
        rows={list.data?.data}
        rowKey={(r) => r.id}
        loading={list.isPending}
        error={list.error}
        onRetry={() => {
          void list.refetch();
        }}
        empty={
          <EmptyState
            title="No requirements yet"
            description="Tell verified experts what you are looking for."
          />
        }
        columns={[
          { header: 'Requirement', cell: open },
          { header: 'Budget', cell: budget },
          { header: 'Status', cell: (r) => <RequirementStatusBadge status={r.status} /> },
          {
            header: 'Unlocked',
            cell: (r) =>
              r.maxUnlocks === null ? '—' : `${String(r.unlockCount)} of ${String(r.maxUnlocks)}`,
          },
        ]}
        card={(r) => (
          <div className="flex flex-col gap-1.5">
            {open(r)}
            <span className="text-sm text-zinc-600">{budget(r)}</span>
            <RequirementStatusBadge status={r.status} />
          </div>
        )}
      />
    </div>
  );
}
