import { sql, type Actor, type Em } from '@hanu/service-kit';
import { http, HttpResponse } from 'msw/http';
import { randomUUID } from 'node:crypto';
import type { RequirementInput } from '../modules/requirements/index.js';

/** Test-only helpers shared by the lead-service integration tests. */
export const DB_URL =
  process.env.TEST_LEAD_DATABASE_URL ??
  'postgresql://svc_lead:svc_lead@localhost:5433/real_estate_test';
export const CATALOG = 'http://catalog.test';
export const IDENTITY = 'http://identity.test';

export const CITY = randomUUID();
export const LOCALITY = randomUUID();
export const STATE = randomUUID();
export const FLAT = randomUUID();
export const RETIRED_TYPE = randomUUID();

const LOCATIONS = new Map<
  string,
  { id: string; type: string; cityId: string | null; isActive: boolean }
>([
  [CITY, { id: CITY, type: 'city', cityId: CITY, isActive: true }],
  [LOCALITY, { id: LOCALITY, type: 'locality', cityId: CITY, isActive: true }],
  [STATE, { id: STATE, type: 'state', cityId: null, isActive: true }],
]);
const TYPES = new Map<string, { id: string; kind: string; isActive: boolean }>([
  [FLAT, { id: FLAT, kind: 'flat', isActive: true }],
  [RETIRED_TYPE, { id: RETIRED_TYPE, kind: 'plot', isActive: false }],
]);

function ids(request: Request): string[] {
  return new URL(request.url).searchParams.get('ids')?.split(',') ?? [];
}

/** catalog's `/internal/*`, intercepted at the network layer. */
export const catalogHandlers = [
  http.get(`${CATALOG}/internal/locations`, ({ request }) =>
    HttpResponse.json({ data: ids(request).flatMap((id) => LOCATIONS.get(id) ?? []) }),
  ),
  http.get(`${CATALOG}/internal/property-types`, ({ request }) =>
    HttpResponse.json({ data: ids(request).flatMap((id) => TYPES.get(id) ?? []) }),
  ),
];

export function buyer(userId: string = randomUUID()): Actor {
  return { service: 'lead-service', userId, ip: '127.0.0.1' };
}

export function requirementInput(overrides: Partial<RequirementInput> = {}): RequirementInput {
  return {
    purpose: 'buy',
    propertyTypeId: FLAT,
    locationIds: [CITY, LOCALITY],
    budgetMin: '6000000000',
    budgetMax: '8500000000',
    bedrooms: [3],
    areaMin: '1500',
    areaMax: '2000',
    areaUnit: 'sqft',
    possession: 'ready',
    timeline: 'within_3_months',
    loanNeeded: true,
    preferences: { facing: 'east', lift: true },
    notes: 'Near a school, 2nd floor or higher',
    ...overrides,
  };
}

export async function truncateLead(em: Em): Promise<void> {
  await sql(
    em,
    `truncate requirements, requirement_locations, lead_unlocks, buyer_contacts,
              outbox_events, inbox_events cascade`,
  );
  await sql(em, "delete from state_transitions where entity_type = 'requirement'");
}
