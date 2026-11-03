import { LOCATION_TYPES, type LocationType } from '@hanu/contracts';
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
import { LocationForm } from './LocationForm';
import { TYPE_LABELS, type Location } from './types';

function typeOf(raw: string | null): LocationType {
  return LOCATION_TYPES.find((t) => t === raw) ?? 'state';
}

export function LocationsPage() {
  const [params, setParams] = useSearchParams();
  const type = typeOf(params.get('type'));
  const labels = TYPE_LABELS.get(type);
  const parentType = labels?.parent ?? null;
  const parentId = params.get('parentId') ?? undefined;
  const [editing, setEditing] = useState<Location | 'new' | null>(null);

  const list = useCatalogList<Location>('locations', { type, parentId });
  const parents = useCatalogList<Location>(
    'locations',
    { type: parentType ?? undefined },
    parentType !== null,
  );
  const rows = useListFilters(
    list.data,
    (l) => `${l.name} ${l.slug}`,
    (l) => l.isActive,
  );
  const parentName = new Map((parents.data ?? []).map((p) => [p.id, p.name]));
  const one = labels?.one ?? 'location';

  const add = (
    <Button
      onClick={() => {
        setEditing('new');
      }}
    >
      <Plus aria-hidden="true" className="size-4" /> Add {one}
    </Button>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={labels?.many ?? 'Locations'}
        {...(rows === undefined ? {} : { count: rows.length })}
        actions={add}
      />
      <FilterTabs
        label="Location type"
        param="type"
        tabs={LOCATION_TYPES.map((t) => ({ value: t, label: TYPE_LABELS.get(t)?.many ?? t }))}
      />
      <CatalogToolbar>
        {parentType !== null && (
          <label className="flex items-center text-sm">
            <span className="sr-only">{parentType === 'state' ? 'State' : 'City'}</span>
            <select
              value={parentId ?? ''}
              onChange={(e) => {
                const value = e.target.value;
                setParams((prev) => {
                  const next = new URLSearchParams(prev);
                  if (value === '') next.delete('parentId');
                  else next.set('parentId', value);
                  return next;
                });
              }}
              className="h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              <option value="">{parentType === 'state' ? 'All states' : 'All cities'}</option>
              {(parents.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </CatalogToolbar>
      <DataList
        caption={labels?.many ?? 'Locations'}
        rows={rows}
        rowKey={(l) => l.id}
        loading={list.isPending}
        error={list.error}
        onRetry={() => void list.refetch()}
        empty={
          <EmptyState
            title={`No ${(labels?.many ?? 'locations').toLowerCase()} found`}
            description="Change the filters, or add one."
            action={add}
          />
        }
        columns={[
          { header: 'Name', cell: (l) => <span className="font-medium">{l.name}</span> },
          ...(parentType === null
            ? []
            : [
                {
                  header: parentType === 'state' ? 'State' : 'City',
                  cell: (l: Location) => parentName.get(l.parentId ?? '') ?? '—',
                },
              ]),
          { header: 'Slug', cell: (l) => <span className="text-zinc-500">{l.slug}</span> },
          ...(type === 'state' ? [{ header: 'Code', cell: (l: Location) => l.code ?? '—' }] : []),
          { header: 'Status', cell: (l) => <ActiveBadge active={l.isActive} /> },
          {
            header: 'Actions',
            className: 'w-12 text-right',
            cell: (l) => (
              <CatalogRowActions
                resource="locations"
                id={l.id}
                name={l.name}
                isActive={l.isActive}
                onEdit={() => {
                  setEditing(l);
                }}
              />
            ),
          },
        ]}
        card={(l) => (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{l.name}</p>
              <p className="truncate text-xs text-zinc-500">
                {[parentName.get(l.parentId ?? ''), l.slug].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ActiveBadge active={l.isActive} />
              <CatalogRowActions
                resource="locations"
                id={l.id}
                name={l.name}
                isActive={l.isActive}
                onEdit={() => {
                  setEditing(l);
                }}
              />
            </div>
          </div>
        )}
      />
      {editing !== null && (
        <LocationForm
          type={type}
          parents={parents.data ?? []}
          {...(editing === 'new' ? {} : { initial: editing })}
          {...(parentId === undefined ? {} : { defaultParentId: parentId })}
          onClose={() => {
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
