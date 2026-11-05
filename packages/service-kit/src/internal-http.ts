import { AppError, ValidationError } from './errors.js';

/** Another service did not answer in time or answered with an error. */
export class UpstreamError extends AppError {
  constructor(message = 'A required service is unavailable') {
    super('UPSTREAM_UNAVAILABLE', message, 503);
  }
}

/**
 * "Ask" another service: GET `/internal/*` with a timeout. Reads need no idempotency key;
 * a later internal write helper adds one.
 */
export async function internalGet<T>(
  baseUrl: string,
  path: string,
  opts: { timeoutMs?: number } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      signal: AbortSignal.timeout(opts.timeoutMs ?? 2000),
    });
  } catch {
    throw new UpstreamError();
  }
  if (!response.ok) throw new UpstreamError();
  return (await response.json()) as T;
}

/** A place a requirement, account or listing covers: the location and the city it is in. */
export interface Area {
  locationId: string;
  cityId: string;
}

interface LocationAnswer {
  id: string;
  type: string;
  cityId: string | null;
  isActive: boolean;
}

/**
 * Asks catalog about the areas. Every id must be a live city or locality; the city is copied so
 * later filters by city need no call. Call it before any transaction, so no lock waits on catalog.
 */
export async function resolveAreas(catalogUrl: string, ids: readonly string[]): Promise<Area[]> {
  const unique = [...new Set(ids)];
  const { data } = await internalGet<{ data: LocationAnswer[] }>(
    catalogUrl,
    `/internal/locations?ids=${unique.join(',')}`,
  );
  const found = new Map(data.map((location) => [location.id, location]));
  return unique.map((id) => {
    const location = found.get(id);
    if (location === undefined || !location.isActive || location.cityId === null) {
      throw new ValidationError('body/locationIds Each area must be an active city or locality');
    }
    return { locationId: id, cityId: location.cityId };
  });
}

/** Asks catalog whether a property type can be picked; returns its kind (flat, plot …). */
export async function resolvePropertyType(catalogUrl: string, id: string): Promise<string> {
  const { data } = await internalGet<{ data: { id: string; kind: string; isActive: boolean }[] }>(
    catalogUrl,
    `/internal/property-types?ids=${id}`,
  );
  const type = data[0];
  if (type?.isActive !== true) {
    throw new ValidationError('body/propertyTypeId Choose an active property type');
  }
  return type.kind;
}
