import { DataList, EmptyState, PageHeader } from '@hanu/web-kit';
import { useReference } from '../api';
import { formatMoney } from '../requirements/requirements-api';
import { useMyLeads, type MyLead } from './leads-api';

/** The requirements this account unlocked, with the buyer's name and phone. */
export function MyLeadsPage() {
  const leads = useMyLeads();
  const reference = useReference();
  const currency = reference.data?.platform.currency ?? 'INR';
  const locale = reference.data?.platform.locale ?? 'en-IN';
  const types = new Map((reference.data?.propertyTypes ?? []).map((t) => [t.id, t.name]));
  const places = new Map((reference.data?.locations ?? []).map((p) => [p.id, p.name]));
  const need = (l: MyLead) =>
    `${l.purpose === 'buy' ? 'Buy' : 'Rent'} ${types.get(l.propertyTypeId) ?? 'property'} in ${l.areas
      .map((a) => places.get(a.locationId) ?? '')
      .filter((n) => n !== '')
      .join(', ')}`;
  const budget = (l: MyLead) =>
    `${formatMoney(l.budgetMin, currency, locale)} – ${formatMoney(l.budgetMax, currency, locale)}`;
  const call = (l: MyLead) => (
    <a href={`tel:${l.buyer.phone}`} className="font-medium text-accent hover:underline">
      {l.buyer.phone}
    </a>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="My leads" />
      <DataList
        caption="My leads"
        rows={leads.data?.data}
        rowKey={(l) => l.unlockId}
        loading={leads.isPending}
        error={leads.error}
        onRetry={() => {
          void leads.refetch();
        }}
        empty={
          <EmptyState
            title="No leads yet"
            description="Leads you unlock appear here with the buyer's number."
          />
        }
        columns={[
          { header: 'Buyer', cell: (l) => l.buyer.name },
          { header: 'Phone', cell: call },
          { header: 'Looking for', cell: need },
          { header: 'Budget', cell: budget },
        ]}
        card={(l) => (
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{l.buyer.name}</span>
            {call(l)}
            <span className="text-zinc-600">{need(l)}</span>
            <span className="text-zinc-600">{budget(l)}</span>
          </div>
        )}
      />
    </div>
  );
}
