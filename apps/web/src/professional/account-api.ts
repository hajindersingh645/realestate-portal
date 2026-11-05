import type { AccountStatus, AccountType } from '@hanu/contracts';
import { api } from '@hanu/web-kit';
import { useQuery } from '@tanstack/react-query';
import { orNull } from '../api';

export interface MyAccount {
  id: string;
  type: AccountType;
  displayName: string;
  slug: string;
  about: string | null;
  experienceYears: number | null;
  specialisations: string[];
  licenseNumber: string | null;
  status: AccountStatus;
  areas: { locationId: string; cityId: string }[];
  rejectReason: string | null;
  license: { label: string; mandatory: boolean };
}

/** What the create and edit forms send. `type` only on create, `slug` only while editable. */
export interface AccountBody {
  type?: AccountType;
  displayName: string;
  about?: string;
  experienceYears?: number;
  specialisations?: string[];
  licenseNumber?: string;
  slug?: string;
  locationIds: string[];
}

export const ACCOUNT_KEY = ['accounts', 'me'];

/** The caller's account, or `null` before they create one. */
export function useMyAccount() {
  return useQuery({
    queryKey: ACCOUNT_KEY,
    queryFn: () => orNull(api<MyAccount>('/accounts/me')),
  });
}
