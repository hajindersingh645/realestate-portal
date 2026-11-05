/** Groups of the catalog `lookups` table that exist at launch. Add a group here before using it. */
export const LOOKUP_GROUPS = [
  'bhk',
  'building_type',
  'plot_size',
  'furnishing',
  'facing',
  'possession',
  'timeline',
  'amenity',
  'specialisation',
  'area_unit',
] as const;
export type LookupGroup = (typeof LOOKUP_GROUPS)[number];

/** Decides which set of listing fields applies to a property type. */
export const PROPERTY_KINDS = ['flat', 'house', 'plot', 'commercial'] as const;
export type PropertyKind = (typeof PROPERTY_KINDS)[number];

export const LOCATION_TYPES = ['state', 'city', 'locality'] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

/** Admin-editable texts that appear inside forms. A key is added here when a form needs one. */
export const CONTENT_BLOCK_KEYS = ['signup.data_notice'] as const;
export type ContentBlockKey = (typeof CONTENT_BLOCK_KEYS)[number];
