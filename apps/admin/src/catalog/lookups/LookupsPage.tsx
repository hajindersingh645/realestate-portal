import { LOOKUP_GROUPS, type LookupGroup } from '@hanu/contracts';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '../../ui/Button';
import { DataList } from '../../ui/DataList';
import { EmptyState } from '../../ui/EmptyState';
import { FilterTabs } from '../../ui/FilterTabs';
import { PageHeader } from '../../ui/PageHeader';
import { ActiveBadge } from '../ActiveBadge';
import { useCatalogList } from '../catalog-api';
import { CatalogRowActions } from '../CatalogRowActions';
import { CatalogToolbar } from '../CatalogToolbar';
import { useListFilters } from '../useListFilters';
import { GROUP_LABELS } from './groups';
import { LookupForm } from './LookupForm';

export interface Lookup {
  id: string;
  group: LookupGroup;
  code: string;
  label: string;
  isActive: boolean;
  sort: number;
}

export function LookupsPage() {
  const [params] = useSearchParams();
  const group = LOOKUP_GROUPS.find((g) => g === params.get('group')) ?? LOOKUP_GROUPS[0];
  const [editing, setEditing] = useState<Lookup | 'new' | null>(null);
  const list = useCatalogList<Lookup>('lookups', { group });
  const rows = useListFilters(
    list.data,
    (l) => `${l.label} ${l.code}`,
    (l) => l.isActive,
  );
  const title = GROUP_LABELS.get(group) ?? group;

  const add = (
    <Button
      onClick={() => {
        setEditing('new');
      }}
    >
      <Plus aria-hidden="true" className="size-4" /> Add entry
    </Button>
  );
  const actions = (l: Lookup) => (
    <CatalogRowActions
      resource="lookups"
      id={l.id}
      name={l.label}
      isActive={l.isActive}
      onEdit={() => {
        setEditing(l);
      }}
    />
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={title}
        {...(rows === undefined ? {} : { count: rows.length })}
        actions={add}
      />
      <FilterTabs
        label="List"
        param="group"
        tabs={LOOKUP_GROUPS.map((g) => ({ value: g, label: GROUP_LABELS.get(g) ?? g }))}
      />
      <CatalogToolbar />
      <DataList
        caption={title}
        rows={rows}
        rowKey={(l) => l.id}
        loading={list.isPending}
        error={list.error}
        onRetry={() => void list.refetch()}
        empty={
          <EmptyState
            title="Nothing in this list"
            description="Change the filters, or add an entry."
            action={add}
          />
        }
        columns={[
          { header: 'Label', cell: (l) => <span className="font-medium">{l.label}</span> },
          { header: 'Code', cell: (l) => <span className="text-zinc-500">{l.code}</span> },
          { header: 'Status', cell: (l) => <ActiveBadge active={l.isActive} /> },
          { header: 'Actions', className: 'w-12 text-right', cell: actions },
        ]}
        card={(l) => (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{l.label}</p>
              <p className="truncate text-xs text-zinc-500">{l.code}</p>
            </div>
            <div className="flex items-center gap-2">
              <ActiveBadge active={l.isActive} />
              {actions(l)}
            </div>
          </div>
        )}
      />
      {editing !== null && (
        <LookupForm
          group={group}
          {...(editing === 'new' ? {} : { initial: editing })}
          onClose={() => {
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
