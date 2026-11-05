import type { PermissionKey } from '@hanu/contracts';
import {
  BadgeCheck,
  Building2,
  ClipboardList,
  FileText,
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

/** Every section of the admin. Later phases add groups here (Billing). */
export const NAV: NavGroup[] = [
  {
    group: 'Leads',
    items: [
      {
        label: 'Requirements',
        description: 'Approve, reject and hide buyer requirements',
        path: PATHS.requirements,
        icon: ClipboardList,
        permission: 'admin.lead.moderate',
      },
    ],
  },
  {
    group: 'Professionals',
    items: [
      {
        label: 'Professionals',
        description: 'Approve, reject and suspend profiles',
        path: PATHS.professionals,
        icon: BadgeCheck,
        permission: 'admin.account.review',
      },
    ],
  },
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
  {
    group: 'Site',
    items: [
      {
        label: 'Content',
        description: 'The sign-up data-protection notice',
        path: PATHS.content,
        icon: FileText,
        permission: 'admin.settings.manage',
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
