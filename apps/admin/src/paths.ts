/** Every route path in the admin. Components link with these, never with string literals. */
export const PATHS = {
  login: '/login',
  setup: '/setup',
  home: '/',
  locations: '/catalog/locations',
  propertyTypes: '/catalog/property-types',
  lookups: '/catalog/lookups',
  unitConversions: '/catalog/unit-conversions',
  users: '/access/users',
  user: (id: string): string => `/access/users/${id}`,
  roles: '/access/roles',
  auditLog: '/access/audit-log',
  professionals: '/professionals',
  professional: (id: string): string => `/professionals/${id}`,
  content: '/content',
} as const;
