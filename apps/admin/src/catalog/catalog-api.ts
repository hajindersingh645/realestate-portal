import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { api, type ApiInit } from '../api/client';
import { ApiError } from '../api/errors';
import { toast } from '../ui/toast-store';

/** Catalog admin routes, reached through the gateway's `/api/v1/catalog` prefix. */
export type CatalogResource = 'locations' | 'property-types' | 'lookups' | 'unit-conversions';

export function catalogPath(resource: CatalogResource, rest = ''): string {
  return `/catalog/admin/${resource}${rest}`;
}

/** One list of a catalog resource. `query` becomes the query string and part of the cache key. */
export function useCatalogList<T>(
  resource: CatalogResource,
  query: Record<string, string | undefined> = {},
  enabled = true,
): UseQueryResult<T[]> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined && value !== '') params.set(key, value);
  const search = params.size > 0 ? `?${params.toString()}` : '';
  return useQuery({
    queryKey: ['catalog', resource, search],
    queryFn: async () => (await api<{ data: T[] }>(catalogPath(resource, search))).data,
    enabled,
  });
}

/** A write to a catalog resource. On success the resource's lists reload and a toast confirms it. */
export function useCatalogWrite(resource: CatalogResource, done: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ path = '', ...init }: ApiInit & { path?: string }) =>
      api<unknown>(catalogPath(resource, path), init),
    onSuccess: async () => {
      toast.success(done);
      await queryClient.invalidateQueries({ queryKey: ['catalog', resource] });
    },
  });
}

/**
 * Field errors from a refused save: validation messages per field, and a 409 (duplicate) shown
 * under the field that must be unique.
 */
export function fieldErrors(error: unknown, uniqueField: string): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  if (error.status === 409) return { [uniqueField]: error.message };
  return error.fields;
}

/** Whether the refused save has a message that is not tied to one field (shown above the form). */
export function formLevelError(error: unknown): unknown {
  return error instanceof ApiError && (error.status === 409 || Object.keys(error.fields).length > 0)
    ? null
    : error;
}
