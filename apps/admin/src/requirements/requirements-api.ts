import type { RequirementDecision, RequirementStatus } from '@hanu/contracts';
import { api, toast } from '@hanu/web-kit';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface RequirementRow {
  id: string;
  status: RequirementStatus;
  purpose: string;
  propertyTypeId: string;
  cityIds: string[];
  budgetMin: string;
  budgetMax: string;
  buyerName: string | null;
  submittedAt: string | null;
  createdAt: string;
}

export interface RequirementDetail extends RequirementRow {
  buyerPhone: string | null;
  areas: { locationId: string; cityId: string }[];
  bedrooms: number[];
  areaMin: string | null;
  areaMax: string | null;
  areaUnit: string | null;
  possession: string | null;
  timeline: string | null;
  loanNeeded: boolean | null;
  notes: string | null;
  unlockCount: number;
  maxUnlocks: number | null;
  feeType: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  transitions: {
    fromStatus: string | null;
    toStatus: string;
    reason: string | null;
    actorUserId: string | null;
    createdAt: string;
  }[];
}

export type RequirementCounts = Record<RequirementStatus | 'all', number>;

const BASE = '/lead/admin/requirements';
const KEY = ['lead', 'admin', 'requirements'];
const qs = (params: URLSearchParams) => {
  const s = params.toString();
  return s === '' ? '' : `?${s}`;
};

/** Newest first, 50 at a time; `filter` becomes the query string. */
export function useRequirements(filter: URLSearchParams, enabled: boolean) {
  return useInfiniteQuery({
    enabled,
    queryKey: [...KEY, filter.toString()],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const query = new URLSearchParams(filter);
      if (pageParam !== null) query.set('cursor', pageParam);
      return api<{ data: RequirementRow[]; nextCursor: string | null }>(`${BASE}${qs(query)}`);
    },
    getNextPageParam: (last) => last.nextCursor,
  });
}

export function useRequirementCounts(filter: URLSearchParams) {
  return useQuery({
    queryKey: [...KEY, 'counts', filter.toString()],
    queryFn: () => api<RequirementCounts>(`${BASE}/counts${qs(filter)}`),
  });
}

export function useRequirement(id: string) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => api<RequirementDetail>(`${BASE}/${id}`),
  });
}

export function useRequirementDecision(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { action: RequirementDecision; reason?: string }) =>
      api<RequirementDetail>(`${BASE}/${id}/decision`, { method: 'POST', body }),
    onSuccess: async (saved) => {
      toast.success(`Requirement is now ${saved.status.replace('_', ' ')}`);
      await queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}

/** What staff may do from each status; the server refuses anything else with 409. */
export const REQUIREMENT_ACTIONS = new Map<
  RequirementStatus,
  { action: RequirementDecision; label: string }[]
>([
  [
    'pending_review',
    [
      { action: 'approve', label: 'Approve' },
      { action: 'reject', label: 'Reject' },
    ],
  ],
  [
    'live',
    [
      { action: 'hide', label: 'Hide' },
      { action: 'fake', label: 'Mark fake' },
    ],
  ],
  ['hidden', [{ action: 'fake', label: 'Mark fake' }]],
]);

export const DECISION_MESSAGES = new Map<RequirementDecision, string>([
  [
    'approve',
    'It goes live for verified experts (or waits for payment), and the buyer gets an SMS.',
  ],
  ['reject', 'The buyer sees your reason as written, can edit and resubmit.'],
  ['hide', 'Experts stop seeing it. Unlocks already made stay.'],
  ['fake', 'It is removed for good and counts against the buyer.'],
]);
