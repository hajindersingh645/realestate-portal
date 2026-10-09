export const EXCHANGES = {
  catalog: 'catalog.events',
  dlx: 'dlx.exchange',
} as const;

export const ROUTING_KEYS = {
  demoPinged: 'demo.pinged',
} as const;

export interface EventEnvelope<T = unknown> {
  eventId: string;
  timestamp: string;
  producer: string;
  payload: T;
}

export interface DemoPingedPayload {
  pingId: string;
  fail: boolean;
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
