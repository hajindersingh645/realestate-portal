import { useReference } from '../api';
import { formatMoney, type RequirementBody } from './requirements-api';

/** Label/value rows for a requirement, with names from catalog's reference data. */
export function useDescribe(): (r: RequirementBody) => { label: string; value: string }[] {
  const reference = useReference();
  const data = reference.data;
  const currency = data?.platform.currency ?? 'INR';
  const locale = data?.platform.locale ?? 'en-IN';
  const place = new Map((data?.locations ?? []).map((p) => [p.id, p.name]));
  const type = new Map((data?.propertyTypes ?? []).map((t) => [t.id, t.name]));
  const lookup = new Map((data?.lookups ?? []).map((l) => [`${l.group}:${l.code}`, l.label]));
  const label = (group: string, code: string | undefined) =>
    code === undefined ? undefined : (lookup.get(`${group}:${code}`) ?? code);

  return (r) =>
    [
      { label: 'Looking to', value: r.purpose === 'buy' ? 'Buy' : 'Rent' },
      { label: 'Property type', value: type.get(r.propertyTypeId) ?? '—' },
      { label: 'Areas', value: r.locationIds.map((id) => place.get(id) ?? id).join(', ') },
      {
        label: 'Budget',
        value: `${formatMoney(r.budgetMin, currency, locale)} – ${formatMoney(r.budgetMax, currency, locale)}`,
      },
      {
        label: 'Bedrooms',
        value:
          r.bedrooms === undefined || r.bedrooms.length === 0 ? undefined : r.bedrooms.join(', '),
      },
      {
        label: 'Size',
        value:
          r.areaMin === undefined && r.areaMax === undefined
            ? undefined
            : `${r.areaMin ?? '…'} – ${r.areaMax ?? '…'} ${label('area_unit', r.areaUnit) ?? ''}`.trim(),
      },
      { label: 'Possession', value: label('possession', r.possession) },
      { label: 'Timeline', value: label('timeline', r.timeline) },
      {
        label: 'Home loan',
        value: r.loanNeeded === undefined ? undefined : r.loanNeeded ? 'Needed' : 'Not needed',
      },
      { label: 'Notes', value: r.notes },
    ].filter(
      (row): row is { label: string; value: string } => row.value !== undefined && row.value !== '',
    );
}

/** A saved requirement in the form's shape, so one description serves both. */
export function asBody(r: {
  purpose: RequirementBody['purpose'];
  propertyTypeId: string;
  areas: { locationId: string }[];
  budgetMin: string;
  budgetMax: string;
  bedrooms: number[];
  areaMin: string | null;
  areaMax: string | null;
  areaUnit: string | null;
  possession: string | null;
  timeline: string | null;
  loanNeeded: boolean | null;
  notes: string | null;
}): RequirementBody {
  return {
    purpose: r.purpose,
    propertyTypeId: r.propertyTypeId,
    locationIds: r.areas.map((a) => a.locationId),
    budgetMin: r.budgetMin,
    budgetMax: r.budgetMax,
    bedrooms: r.bedrooms,
    ...(r.areaMin === null ? {} : { areaMin: r.areaMin }),
    ...(r.areaMax === null ? {} : { areaMax: r.areaMax }),
    ...(r.areaUnit === null ? {} : { areaUnit: r.areaUnit }),
    ...(r.possession === null ? {} : { possession: r.possession }),
    ...(r.timeline === null ? {} : { timeline: r.timeline }),
    ...(r.loanNeeded === null ? {} : { loanNeeded: r.loanNeeded }),
    ...(r.notes === null ? {} : { notes: r.notes }),
  };
}
