export const EXCHANGES = {
  catalog: 'catalog.events',
  identity: 'identity.events',
  dlx: 'dlx.exchange',
} as const;

export const ROUTING_KEYS = {
  referenceChanged: 'reference.changed',
  otpRequested: 'otp.requested',
  userRegistered: 'user.registered',
  userContactChanged: 'user.contact.changed',
  userAccessChanged: 'user.access.changed',
  accountApproved: 'account.approved',
  accountRejected: 'account.rejected',
  /** Also sent on a ban, with `status: 'banned'`. */
  accountSuspended: 'account.suspended',
  /** Published on each producing service's own exchange. */
  auditRecorded: 'audit.recorded',
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

/** One admin or user action, recorded by identity-service in `audit_logs`. */
export interface AuditRecordedPayload {
  actorUserId: string | null; // null for scripts (seed, create-admin)
  service: string;
  action: string; // e.g. 'lookup.updated'
  targetType: string;
  targetId: string;
  diff: { before?: unknown; after?: unknown } | null;
  ip: string | null;
}
