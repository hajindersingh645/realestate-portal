import { ROUTING_KEYS, type AuditRecordedPayload } from '@hanu/contracts';
import type { FastifyRequest } from 'fastify';
import type { Em } from './db.js';
import { UnauthorizedError } from './errors.js';
import { outboxAdd } from './outbox.js';

/** Who did it. Routes build this from the request; scripts pass `userId: null`. */
export interface Actor {
  service: string;
  userId: string | null;
  ip: string | null;
}

/** The actor of a guarded route: the token's user and the client IP. */
export function actorOf(request: FastifyRequest, service: string): Actor {
  if (request.auth === undefined) throw new UnauthorizedError();
  return { service, userId: request.auth.userId, ip: request.ip };
}

export interface AuditEntry {
  action: string;
  targetType: string;
  targetId: string;
  diff?: { before?: unknown; after?: unknown };
}

/**
 * Records the action in the caller's transaction as an `audit.recorded` event on the service's
 * own exchange. identity-service stores it; nothing is written if the transaction rolls back.
 */
export async function audit(
  em: Em,
  exchange: string,
  actor: Actor,
  entry: AuditEntry,
): Promise<string> {
  const payload: AuditRecordedPayload = {
    actorUserId: actor.userId,
    service: actor.service,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    diff: entry.diff ?? null,
    ip: actor.ip,
  };
  return await outboxAdd(em, {
    exchange,
    routingKey: ROUTING_KEYS.auditRecorded,
    producer: actor.service,
    payload,
  });
}
