import { EXCHANGES } from '@hanu/contracts';
import { assertExchanges, connectRabbit } from '@hanu/service-kit';
import { buildApp } from './app.js';
import { config } from './config.js';
import { startMessaging } from './messaging.js';
import { createNotificationOrm } from './orm.js';
import { ConsoleSmsProvider } from './providers/console-sms.js';

const orm = await createNotificationOrm(config.databaseUrl, config.dbSchema);
const app = buildApp({ orm, config });

let stopping = false;
const connection = await connectRabbit(config.rabbitmqUrl, (reason) => {
  if (stopping) return;
  app.log.fatal(
    { err: reason },
    'RabbitMQ connection lost; exiting so the runtime restarts the service',
  );
  process.exit(1);
});
await assertExchanges(connection, [EXCHANGES.identity]);
const messaging = await startMessaging({
  orm,
  connection,
  locale: config.platform.locale,
  sms: new ConsoleSmsProvider(config.nodeEnv, (line) => {
    app.log.info(line);
  }),
  onError: (error) => {
    app.log.error({ err: error }, 'messaging error');
  },
});

await app.listen({ port: config.port, host: '0.0.0.0' });

async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await messaging.stop();
  await connection.close();
  await orm.close();
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
