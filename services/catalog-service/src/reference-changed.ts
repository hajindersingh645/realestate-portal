import {
  EXCHANGES,
  ROUTING_KEYS,
  type ReferenceChangedPayload,
  type ReferenceEntity,
} from '@hanu/contracts';
import { outboxAdd, type Em } from '@hanu/service-kit';

/** Call inside the transaction of every master-data write. */
export async function emitReferenceChanged(
  em: Em,
  producer: string,
  entity: ReferenceEntity,
  id: string,
): Promise<void> {
  const payload: ReferenceChangedPayload = { entity, id };
  await outboxAdd(em, {
    exchange: EXCHANGES.catalog,
    routingKey: ROUTING_KEYS.referenceChanged,
    producer,
    payload,
  });
}
