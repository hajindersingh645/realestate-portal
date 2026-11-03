export const STAFF_ID = '44444444-4444-4444-8444-444444444401';
export const EDITOR_ROLE = '55555555-5555-4555-8555-555555555501';
export const ADMIN_ROLE = '55555555-5555-4555-8555-555555555500';

export const roles = [
  {
    id: ADMIN_ROLE,
    key: 'super_admin',
    name: 'Super admin',
    isSystem: true,
    permissions: ['admin.access.manage', 'admin.catalog.manage'],
  },
  {
    id: EDITOR_ROLE,
    key: 'catalog_editor',
    name: 'Catalog editor',
    isSystem: false,
    permissions: ['admin.catalog.manage'],
  },
];

export function staffDetail(over: Record<string, unknown> = {}) {
  return {
    id: STAFF_ID,
    name: 'Priya Staff',
    phone: '+919815012345',
    email: 'priya@hanu.property',
    registeredAs: 'staff',
    status: 'active',
    createdAt: '2026-11-03T10:00:00.000Z',
    roles: [{ id: EDITOR_ROLE, key: 'catalog_editor', name: 'Catalog editor' }],
    overrides: [],
    permissions: ['admin.catalog.manage'],
    ...over,
  };
}
