export const EXCHANGES = {
  catalog: 'catalog.events',
  dlx: 'dlx.exchange',
} as const;

export const ROUTING_KEYS = {
  referenceChanged: 'reference.changed',
} as const;

export interface EventEnvelope<T = unknown> {
  eventId: string;
  timestamp: string;
  producer: string;
  payload: T;
}

export function isEventEnvelope(value: unknown): value is EventEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.eventId === 'string' &&
    typeof v.timestamp === 'string' &&
    typeof v.producer === 'string' &&
    typeof v.payload === 'object' &&
    v.payload !== null
  );
}

export const REFERENCE_ENTITIES = [
  'location',
  'property_type',
  'lookup',
  'unit_conversion',
] as const;
export type ReferenceEntity = (typeof REFERENCE_ENTITIES)[number];

/** Says which master-data row changed. Consumers reload their copy; the payload carries no data. */
export interface ReferenceChangedPayload {
  entity: ReferenceEntity;
  id: string;
}
