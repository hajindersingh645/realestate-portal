import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button, DataList, EmptyState, PageHeader } from '@hanu/web-kit';
import { useCatalogList } from '../catalog-api';
import { CatalogRowActions } from '../CatalogRowActions';
import { CatalogToolbar } from '../CatalogToolbar';
import type { Location } from '../locations/types';
import type { Lookup } from '../lookups/LookupsPage';
import { useListFilters } from '../useListFilters';
import { UnitConversionForm } from './UnitConversionForm';

export interface UnitConversion {
  id: string;
  unitId: string;
  locationId: string | null;
  factor: number;
}

export interface Option {
  value: string;
  label: string;
}

export function UnitConversionsPage() {
  const [editing, setEditing] = useState<UnitConversion | 'new' | null>(null);
  const list = useCatalogList<UnitConversion>('unit-conversions');
  const units = useCatalogList<Lookup>('lookups', { group: 'area_unit' });
  const cities = useCatalogList<Location>('locations', { type: 'city' });
  const unitName = new Map((units.data ?? []).map((u) => [u.id, u.label]));
  const cityName = new Map((cities.data ?? []).map((c) => [c.id, c.name]));
  const label = (c: UnitConversion) =>
    `${unitName.get(c.unitId) ?? 'Unknown unit'} · ${c.locationId === null ? 'Every city' : (cityName.get(c.locationId) ?? 'Unknown city')}`;
  const rows = useListFilters(list.data, label);

  const add = (
    <Button
      onClick={() => {
        setEditing('new');
      }}
    >
      <Plus aria-hidden="true" className="size-4" /> Add conversion
    </Button>
  );
  const actions = (c: UnitConversion) => (
    <CatalogRowActions
      resource="unit-conversions"
      id={c.id}
      name={label(c)}
      onEdit={() => {
        setEditing(c);
      }}
    />
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Unit conversions"
        {...(rows === undefined ? {} : { count: rows.length })}
        actions={add}
      />
      <CatalogToolbar showStatus={false} />
      <DataList
        caption="Unit conversions"
        rows={rows}
        rowKey={(c) => c.id}
        loading={list.isPending}
        error={list.error}
        onRetry={() => void list.refetch()}
        empty={
          <EmptyState
            title="No unit conversions yet"
            description="A conversion without a city applies everywhere; a city's own one overrides it."
            action={add}
          />
        }
        columns={[
          {
            header: 'Unit',
            cell: (c) => (
              <span className="font-medium">{unitName.get(c.unitId) ?? 'Unknown unit'}</span>
            ),
          },
          {
            header: 'City',
            cell: (c) =>
              c.locationId === null ? (
                <span className="text-zinc-500">Every city</span>
              ) : (
                (cityName.get(c.locationId) ?? 'Unknown city')
              ),
          },
          { header: 'Factor', className: 'tabular-nums', cell: (c) => c.factor },
          { header: 'Actions', className: 'w-12 text-right', cell: actions },
        ]}
        card={(c) => (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{label(c)}</p>
              <p className="text-xs tabular-nums text-zinc-500">× {c.factor}</p>
            </div>
            {actions(c)}
          </div>
        )}
      />
      {editing !== null && (
        <UnitConversionForm
          units={(units.data ?? [])
            .filter((u) => u.isActive)
            .map((u) => ({ value: u.id, label: u.label }))}
          cities={(cities.data ?? [])
            .filter((c) => c.isActive)
            .map((c) => ({ value: c.id, label: c.name }))}
          {...(editing === 'new' ? {} : { initial: editing })}
          onClose={() => {
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
