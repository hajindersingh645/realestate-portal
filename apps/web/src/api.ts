import { api, ApiError } from '@hanu/web-kit';
import { useQuery } from '@tanstack/react-query';

export interface Me {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  registeredAs: string;
  permissions: string[];
}

export const ME_KEY = ['users', 'me'];

export function useMe() {
  return useQuery({ queryKey: ME_KEY, queryFn: () => api<Me>('/users/me') });
}

export interface Notice {
  id: string;
  version: number;
  body: string;
  links: { label: string; url: string }[];
}

export interface Place {
  id: string;
  type: string;
  parentId: string | null;
  name: string;
  isActive: boolean;
}

export interface Lookup {
  group: string;
  code: string;
  label: string;
  isActive: boolean;
}

interface Reference {
  platform: { currency: string; locale: string };
  locations: Place[];
  propertyTypes: { id: string; name: string; isActive: boolean }[];
  lookups: Lookup[];
  notices: Partial<Record<string, Notice>>;
}

/** Catalog's public reference data: cities, localities and the current notices. */
export function useReference() {
  return useQuery({
    queryKey: ['catalog', 'reference'],
    queryFn: () => api<Reference>('/catalog/reference'),
    staleTime: 5 * 60_000,
  });
}

/** `null` when the server says 404, so "nothing yet" is data, not an error screen. */
export async function orNull<T>(request: Promise<T>): Promise<T | null> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
