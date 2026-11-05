import type { AccountDecision, AccountStatus, AccountType } from '@hanu/contracts';
import { api, toast } from '@hanu/web-kit';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IDENTITY } from '../access/access-api';

export interface AccountRow {
  id: string;
  type: AccountType;
  displayName: string;
  slug: string;
  status: AccountStatus;
  createdAt: string;
  owner: { userId: string; name: string; phone: string };
}

export interface Transition {
  fromStatus: AccountStatus | null;
  toStatus: AccountStatus;
  reason: string | null;
  actorUserId: string | null;
  actorName: string | null;
  createdAt: string;
}

export interface AccountDetail extends Omit<AccountRow, 'owner'> {
  about: string | null;
  experienceYears: number | null;
  specialisations: string[];
  licenseNumber: string | null;
  owner: AccountRow['owner'] & { email: string | null };
  areas: { locationId: string; cityId: string }[];
  transitions: Transition[];
}

const ACCOUNTS = `${IDENTITY}/accounts`;

/** Newest first, 50 at a time; `filter` becomes the query string. */
export function useAccounts(filter: URLSearchParams, enabled = true) {
  const search = filter.toString();
  return useInfiniteQuery({
    enabled,
    queryKey: ['identity', 'accounts', search],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const query = new URLSearchParams(filter);
      if (pageParam !== null) query.set('cursor', pageParam);
      const qs = query.toString();
      return api<{ data: AccountRow[]; nextCursor: string | null }>(
        `${ACCOUNTS}${qs === '' ? '' : `?${qs}`}`,
      );
    },
    getNextPageParam: (last) => last.nextCursor,
  });
}

export type AccountCounts = Record<AccountStatus | 'all', number>;

/** Accounts per status tab, under the same type and search filters as the list. */
export function useAccountCounts(filter: URLSearchParams) {
  const search = filter.toString();
  return useQuery({
    queryKey: ['identity', 'accounts', 'counts', search],
    queryFn: () => api<AccountCounts>(`${ACCOUNTS}/counts${search === '' ? '' : `?${search}`}`),
  });
}

export function useAccount(id: string) {
  return useQuery({
    queryKey: ['identity', 'account', id],
    queryFn: () => api<AccountDetail>(`${ACCOUNTS}/${id}`),
  });
}

export function useDecision(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { action: AccountDecision; reason?: string }) =>
      api<AccountDetail>(`${ACCOUNTS}/${id}/decision`, { method: 'POST', body }),
    onSuccess: async (saved) => {
      toast.success(`${saved.displayName} is now ${saved.status}`);
      await queryClient.invalidateQueries({ queryKey: ['identity'] });
    },
  });
}

/** What staff may do from each status; the server refuses anything else with 409. */
export const ACTIONS = new Map<AccountStatus, { action: AccountDecision; label: string }[]>([
  [
    'pending',
    [
      { action: 'approve', label: 'Approve' },
      { action: 'reject', label: 'Reject' },
      { action: 'ban', label: 'Ban' },
    ],
  ],
  [
    'approved',
    [
      { action: 'suspend', label: 'Suspend' },
      { action: 'ban', label: 'Ban' },
    ],
  ],
  ['rejected', [{ action: 'ban', label: 'Ban' }]],
  [
    'suspended',
    [
      { action: 'reactivate', label: 'Reactivate' },
      { action: 'ban', label: 'Ban' },
    ],
  ],
  ['banned', []],
]);

export const DECISION_ERRORS = {
  CONFLICT: 'Someone already decided this account. Reload to see it.',
};
