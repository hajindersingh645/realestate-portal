import { EXCHANGES, ROUTING_KEYS, type DemoPingedPayload } from '@hanu/contracts';
import { createOutboxRelay, subscribe, type Orm, type RabbitConnection } from '@hanu/service-kit';
import { onDemoPinged } from './consumers/demo-pinged.js';

export const DEMO_QUEUE = 'catalog-service.catalog.demo-pinged';

export async function startMessaging(deps: {
  orm: Orm;
  connection: RabbitConnection;
  serviceName: string;
  onError?: (error: unknown) => void;
}) {
  const relay = createOutboxRelay({
    orm: deps.orm,
    connection: deps.connection,
    onError: deps.onError,
  });
  const demo = await subscribe<DemoPingedPayload>({
    orm: deps.orm,
    connection: deps.connection,
    queue: DEMO_QUEUE,
    exchange: EXCHANGES.catalog,
    keys: [ROUTING_KEYS.demoPinged],
    handler: onDemoPinged,
    onError: deps.onError,
  });
  return {
    relay,
    async stop(): Promise<void> {
      await relay.stop();
      await demo.close();
    },
  };
}
