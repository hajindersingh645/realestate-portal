import { EXCHANGES, ROUTING_KEYS, type UserContactPayload } from '@hanu/contracts';
import { createOutboxRelay, subscribe, type Orm, type RabbitConnection } from '@hanu/service-kit';
import { updateBuyerContact } from './modules/moderation/index.js';

/** Outbox relay, and the copy of buyers' contacts kept current from identity. */
export async function startMessaging(deps: {
  orm: Orm;
  connection: RabbitConnection;
  onError?: (error: unknown) => void;
}) {
  const relay = createOutboxRelay({
    orm: deps.orm,
    connection: deps.connection,
    onError: deps.onError,
  });
  const contacts = await subscribe<UserContactPayload>({
    orm: deps.orm,
    connection: deps.connection,
    queue: 'lead-service.user.contact.changed',
    exchange: EXCHANGES.identity,
    keys: [ROUTING_KEYS.userContactChanged],
    handler: async (envelope, em) => {
      await updateBuyerContact(em, envelope.payload);
    },
    ...(deps.onError === undefined ? {} : { onError: deps.onError }),
  });
  return {
    relay,
    async stop(): Promise<void> {
      await contacts.close();
      await relay.stop();
    },
  };
}
