import { EXCHANGES, ROUTING_KEYS, type UserAccessChangedPayload } from '@hanu/contracts';
import { connectRabbit, subscribeStateless } from '@hanu/service-kit';
import { buildGateway } from './app.js';
import { loadGatewayConfig } from './config.js';
import { RevocationList } from './revocation.js';

const config = loadGatewayConfig();
const revoked = new RevocationList();
const app = await buildGateway({
  ...config,
  revocation: { publicKeyPem: config.jwtPublicKey, list: revoked },
});

// Without the feed a suspended user keeps working for up to 10 minutes; exit and let the runtime restart.
let stopping = false;
const connection = await connectRabbit(config.rabbitmqUrl, (reason) => {
  if (stopping) return;
  app.log.fatal({ err: reason }, 'rabbitmq connection lost');
  process.exit(1);
});
const consumer = await subscribeStateless<UserAccessChangedPayload>({
  connection,
  exchange: EXCHANGES.identity,
  keys: [ROUTING_KEYS.userAccessChanged],
  handler: function recordAccessChange(envelope) {
    revoked.record(envelope.payload.userId, new Date(envelope.payload.changedAt));
  },
  onError: (error, eventId) => {
    app.log.error({ err: error, eventId }, 'access change not recorded');
  },
});

await app.listen({ port: config.port, host: '0.0.0.0' });

async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await consumer.close();
  await connection.close();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  app.log.fatal({ err: reason }, 'unhandled rejection');
  process.exit(1);
});
process.on('uncaughtException', (error) => {
  app.log.fatal({ err: error }, 'uncaught exception');
  process.exit(1);
});
