import type { LocationType } from '@hanu/contracts';

export interface Location {
  id: string;
  type: LocationType;
  parentId: string | null;
  name: string;
  slug: string;
  code: string | null;
  isActive: boolean;
  sort: number;
}

export const TYPE_LABELS = new Map<
  LocationType,
  { one: string; many: string; parent: LocationType | null }
>([
  ['state', { one: 'state', many: 'States', parent: null }],
  ['city', { one: 'city', many: 'Cities', parent: 'state' }],
  ['locality', { one: 'locality', many: 'Localities', parent: 'city' }],
]);
