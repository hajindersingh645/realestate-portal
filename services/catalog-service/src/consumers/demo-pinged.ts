import type { DemoPingedPayload, EventEnvelope } from '@hanu/contracts';
import type { Em } from '@hanu/service-kit';
import { markReceived } from '../modules/demo/index.js';

export async function onDemoPinged(
  envelope: EventEnvelope<DemoPingedPayload>,
  em: Em,
): Promise<void> {
  if (envelope.payload.fail) {
    throw new Error('demo failure requested by the event');
  }
  await markReceived(em, envelope.payload.pingId);
}
