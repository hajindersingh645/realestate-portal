import { buildGateway } from './app.js';
import { loadGatewayConfig } from './config.js';

const config = loadGatewayConfig();
const app = await buildGateway(config);

await app.listen({ port: config.port, host: '0.0.0.0' });

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'shutting down');
  await app.close();
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
