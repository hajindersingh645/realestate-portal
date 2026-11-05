import type { PermissionKey } from '@hanu/contracts';
import {
  Building2,
  History,
  ListChecks,
  MapPin,
  Ruler,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { PATHS } from '../paths';
import { useSession } from '@hanu/web-kit';

export interface NavItem {
  label: string;
  description: string;
  path: string;
  icon: LucideIcon;
  permission: PermissionKey;
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

/** Every section of the admin. Later phases add groups here (Approvals, Leads, Billing). */
export const NAV: NavGroup[] = [
  {
    group: 'Catalog',
    items: [
      {
        label: 'Locations',
        description: 'States, cities and sectors',
        path: PATHS.locations,
        icon: MapPin,
        permission: 'admin.catalog.manage',
      },
      {
        label: 'Property types',
        description: 'Flats, plots, villas and more',
        path: PATHS.propertyTypes,
        icon: Building2,
        permission: 'admin.catalog.manage',
      },
      {
        label: 'Lookups',
        description: 'Amenities, facings and other lists',
        path: PATHS.lookups,
        icon: ListChecks,
        permission: 'admin.catalog.manage',
      },
      {
        label: 'Unit conversions',
        description: 'Area units per city',
        path: PATHS.unitConversions,
        icon: Ruler,
        permission: 'admin.catalog.manage',
      },
    ],
  },
  {
    group: 'Access',
    items: [
      {
        label: 'Users',
        description: 'Staff and members, status and roles',
        path: PATHS.users,
        icon: Users,
        permission: 'admin.user.manage',
      },
      {
        label: 'Roles',
        description: 'What each role is allowed to do',
        path: PATHS.roles,
        icon: ShieldCheck,
        permission: 'admin.access.manage',
      },
      {
        label: 'Audit log',
        description: 'Who changed what, and when',
        path: PATHS.auditLog,
        icon: History,
        permission: 'admin.audit.view',
      },
    ],
  },
];

/** The groups and items this staff member may open. A group with nothing visible is dropped. */
export function useVisibleNav(): NavGroup[] {
  const perms = useSession((s) => s.perms);
  return NAV.map((g) => ({
    group: g.group,
    items: g.items.filter((i) => perms.includes(i.permission)),
  })).filter((g) => g.items.length > 0);
}
