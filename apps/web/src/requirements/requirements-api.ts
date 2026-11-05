import type { RequirementPurpose, RequirementStatus } from '@hanu/contracts';
import { api } from '@hanu/web-kit';
import { useQuery } from '@tanstack/react-query';

export interface MyRequirement {
  id: string;
  status: RequirementStatus;
  purpose: RequirementPurpose;
  propertyTypeId: string;
  areas: { locationId: string; cityId: string }[];
  budgetMin: string;
  budgetMax: string;
  bedrooms: number[];
  areaMin: string | null;
  areaMax: string | null;
  areaUnit: string | null;
  possession: string | null;
  timeline: string | null;
  loanNeeded: boolean | null;
  preferences: Record<string, boolean | string>;
  notes: string | null;
  unlockCount: number;
  maxUnlocks: number | null;
  publishedAt: string | null;
  expiresAt: string | null;
  rejectReason: string | null;
  createdAt: string;
}

/** What the form sends. Money in minor units, as strings. */
export interface RequirementBody {
  purpose: RequirementPurpose;
  propertyTypeId: string;
  locationIds: string[];
  budgetMin: string;
  budgetMax: string;
  bedrooms?: number[];
  areaMin?: string;
  areaMax?: string;
  areaUnit?: string;
  possession?: string;
  timeline?: string;
  loanNeeded?: boolean;
  notes?: string;
}

export interface UnlockedBy {
  accountId: string;
  unlockedAt: string;
  displayName: string | null;
  type: string | null;
  licenseNumber: string | null;
}

export const REQUIREMENTS_KEY = ['requirements', 'mine'];

export function useMyRequirements() {
  return useQuery({
    queryKey: REQUIREMENTS_KEY,
    queryFn: () => api<{ data: MyRequirement[] }>('/lead/requirements/mine'),
  });
}

export function useMyRequirement(id: string | undefined) {
  return useQuery({
    queryKey: [...REQUIREMENTS_KEY, id],
    queryFn: () => api<MyRequirement>(`/lead/requirements/mine/${id ?? ''}`),
    enabled: id !== undefined,
  });
}

export function useUnlockedBy(id: string, enabled: boolean) {
  return useQuery({
    queryKey: [...REQUIREMENTS_KEY, id, 'unlocks'],
    queryFn: () =>
      api<{ data: UnlockedBy[]; namesUnavailable: boolean }>(
        `/lead/requirements/mine/${id}/unlocks`,
      ),
    enabled,
  });
}

/** Digits after the decimal point in `currency` (2 for INR). */
function minorDigits(currency: string): number {
  return (
    new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  );
}

/** A whole amount typed in major units (rupees) → minor units (paise), as a string. */
export function toMinor(major: string, currency: string): string {
  return (BigInt(major) * 10n ** BigInt(minorDigits(currency))).toString();
}

export function toMajor(minor: string, currency: string): string {
  return (BigInt(minor) / 10n ** BigInt(minorDigits(currency))).toString();
}

export function formatMoney(minor: string, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(toMajor(minor, currency)));
}
