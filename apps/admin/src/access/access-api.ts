import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ApiInit, toast } from '@hanu/web-kit';

export const IDENTITY = '/admin/identity';

export interface UserSummary {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  registeredAs: string;
  status: 'active' | 'suspended' | 'banned';
  createdAt: string;
}

export interface UserDetail extends UserSummary {
  roles: { id: string; key: string; name: string }[];
  overrides: { permission: string; effect: 'allow' | 'deny'; reason: string }[];
  permissions: string[];
}

export interface Role {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
  permissions: string[];
}

export interface SetupLink {
  setupUrl: string;
  expiresAt: string;
}

export function useUsers(filter: { status?: string; phone?: string }) {
  const params = new URLSearchParams();
  if (filter.status !== undefined) params.set('status', filter.status);
  if (filter.phone !== undefined) params.set('phone', filter.phone);
  const search = params.size > 0 ? `?${params.toString()}` : '';
  return useQuery({
    queryKey: ['identity', 'users', search],
    queryFn: async () => (await api<{ data: UserSummary[] }>(`${IDENTITY}/users${search}`)).data,
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ['identity', 'user', id],
    queryFn: () => api<UserDetail>(`${IDENTITY}/users/${id}`),
  });
}

export function useRoles(enabled = true) {
  return useQuery({
    queryKey: ['identity', 'roles'],
    queryFn: async () => (await api<{ data: Role[] }>(`${IDENTITY}/roles`)).data,
    enabled,
  });
}

/** A write to identity. On success every identity list and detail reloads; `done` is toasted if given. */
export function useIdentityWrite<T = unknown>(done?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ path, ...init }: ApiInit & { path: string }) =>
      api<T>(`${IDENTITY}${path}`, init),
    onSuccess: async () => {
      if (done !== undefined) toast.success(done);
      await queryClient.invalidateQueries({ queryKey: ['identity'] });
    },
  });
}

/** Messages for identity error codes that read badly as the server wrote them. */
export const ACCESS_ERRORS = { SELF_CHANGE: "You can't change your own access" };

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}
