import { api } from '@hanu/web-kit';
import { useQuery } from '@tanstack/react-query';

interface Named {
  id: string;
  name: string;
}

interface Reference {
  platform?: { currency: string; locale: string };
  locations: Named[];
  propertyTypes?: Named[];
}

export interface ReferenceNames {
  place: (id: string) => string;
  type: (id: string) => string;
  /** Minor units → whole amount in the platform currency. */
  money: (minor: string) => string;
}

/** Names by id and money formatting, from catalog's public reference data. */
export function useReferenceNames(): ReferenceNames {
  const reference = useQuery({
    queryKey: ['catalog', 'reference'],
    queryFn: () => api<Reference>('/catalog/reference'),
    staleTime: 5 * 60_000,
  });
  const places = new Map(reference.data?.locations.map((p) => [p.id, p.name]));
  const types = new Map(reference.data?.propertyTypes?.map((t) => [t.id, t.name]));
  const { currency, locale } = reference.data?.platform ?? { currency: 'INR', locale: 'en-IN' };
  const digits = new Intl.NumberFormat(locale, { style: 'currency', currency }).resolvedOptions()
    .maximumFractionDigits;
  const whole = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  });
  return {
    place: (id) => places.get(id) ?? id,
    type: (id) => types.get(id) ?? 'Property',
    money: (minor) => whole.format(BigInt(minor) / 10n ** BigInt(digits ?? 2)),
  };
}
