import {
  EXCHANGES,
  ROUTING_KEYS,
  type ReferenceChangedPayload,
  type ReferenceEntity,
} from '@hanu/contracts';
import { audit, outboxAdd, type Actor, type Em } from '@hanu/service-kit';

export interface ReferenceChange {
  action: 'created' | 'updated' | 'deleted' | 'seeded';
  before?: unknown;
  after?: unknown;
}

/**
 * Call inside the transaction of every master-data write. Tells other services to reload
 * (`reference.changed`) and records who did it (`audit.recorded`, stored by identity-service).
 */
export async function emitReferenceChanged(
  em: Em,
  actor: Actor,
  entity: ReferenceEntity,
  id: string,
  change: ReferenceChange,
): Promise<void> {
  const payload: ReferenceChangedPayload = { entity, id };
  await outboxAdd(em, {
    exchange: EXCHANGES.catalog,
    routingKey: ROUTING_KEYS.referenceChanged,
    producer: actor.service,
    payload,
  });
  const diff =
    change.before === undefined && change.after === undefined
      ? undefined
      : { before: change.before, after: change.after };
  await audit(em, EXCHANGES.catalog, actor, {
    action: `${entity}.${change.action}`,
    targetType: entity,
    targetId: id,
    ...(diff === undefined ? {} : { diff }),
  });
}
