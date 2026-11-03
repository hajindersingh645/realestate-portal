import { createOutboxRelay, type Orm, type RabbitConnection } from '@hanu/service-kit';

/** The catalog service only publishes. It has an outbox relay and no consumers. */
export function startMessaging(deps: {
  orm: Orm;
  connection: RabbitConnection;
  onError?: (error: unknown) => void;
}) {
  const relay = createOutboxRelay({
    orm: deps.orm,
    connection: deps.connection,
    onError: deps.onError,
  });
  return {
    relay,
    async stop(): Promise<void> {
      await relay.stop();
    },
  };
}
