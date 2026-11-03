import { createOutboxRelay, type Orm, type RabbitConnection } from '@hanu/service-kit';

/** Outbox relay. The audit consumer is added in Task 9. */
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
