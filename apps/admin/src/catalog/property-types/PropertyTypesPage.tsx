import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button, DataList, EmptyState, PageHeader } from '@hanu/web-kit';
import { ActiveBadge } from '../ActiveBadge';
import { useCatalogList } from '../catalog-api';
import { CatalogRowActions } from '../CatalogRowActions';
import { CatalogToolbar } from '../CatalogToolbar';
import { useListFilters } from '../useListFilters';
import { PropertyTypeForm } from './PropertyTypeForm';

export interface PropertyType {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  kind: string;
  isActive: boolean;
  sort: number;
}

export function PropertyTypesPage() {
  const [editing, setEditing] = useState<PropertyType | 'new' | null>(null);
  const list = useCatalogList<PropertyType>('property-types');
  const rows = useListFilters(
    list.data,
    (p) => `${p.name} ${p.slug} ${p.kind}`,
    (p) => p.isActive,
  );
  const names = new Map((list.data ?? []).map((p) => [p.id, p.name]));

  const add = (
    <Button
      onClick={() => {
        setEditing('new');
      }}
    >
      <Plus aria-hidden="true" className="size-4" /> Add property type
    </Button>
  );
  const actions = (p: PropertyType) => (
    <CatalogRowActions
      resource="property-types"
      id={p.id}
      name={p.name}
      isActive={p.isActive}
      onEdit={() => {
        setEditing(p);
      }}
    />
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Property types"
        {...(rows === undefined ? {} : { count: rows.length })}
        actions={add}
      />
      <CatalogToolbar />
      <DataList
        caption="Property types"
        rows={rows}
        rowKey={(p) => p.id}
        loading={list.isPending}
        error={list.error}
        onRetry={() => void list.refetch()}
        empty={
          <EmptyState
            title="No property types found"
            description="Change the filters, or add one."
            action={add}
          />
        }
        columns={[
          { header: 'Name', cell: (p) => <span className="font-medium">{p.name}</span> },
          { header: 'Under', cell: (p) => names.get(p.parentId ?? '') ?? '—' },
          { header: 'Kind', cell: (p) => <span className="capitalize">{p.kind}</span> },
          { header: 'Slug', cell: (p) => <span className="text-zinc-500">{p.slug}</span> },
          { header: 'Status', cell: (p) => <ActiveBadge active={p.isActive} /> },
          { header: 'Actions', className: 'w-12 text-right', cell: actions },
        ]}
        card={(p) => (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{p.name}</p>
              <p className="truncate text-xs capitalize text-zinc-500">
                {[names.get(p.parentId ?? ''), p.kind].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ActiveBadge active={p.isActive} />
              {actions(p)}
            </div>
          </div>
        )}
      />
      {editing !== null && (
        <PropertyTypeForm
          parents={(list.data ?? []).filter((p) => p.parentId === null)}
          {...(editing === 'new' ? {} : { initial: editing })}
          onClose={() => {
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
