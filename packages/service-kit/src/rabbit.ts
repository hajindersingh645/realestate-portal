import { EXCHANGES } from '@hanu/contracts';
import amqplib from 'amqplib';

export type RabbitConnection = Awaited<ReturnType<typeof amqplib.connect>>;
export type RabbitChannel = Awaited<ReturnType<RabbitConnection['createChannel']>>;
export type RabbitConfirmChannel = Awaited<ReturnType<RabbitConnection['createConfirmChannel']>>;

/**
 * Opens one connection for the process. `onLost` is called when it drops.
 * ponytail: services exit on loss and let the runtime restart them;
 * switch to amqplib's `connectWithRecoveryPromise` if restarts become noisy.
 */
export async function connectRabbit(
  url: string,
  onLost: (reason: unknown) => void,
): Promise<RabbitConnection> {
  const connection = await amqplib.connect(url);
  connection.on('error', (error: unknown) => {
    onLost(error);
  });
  connection.on('close', (reason: unknown) => {
    onLost(reason);
  });
  return connection;
}

export async function assertExchanges(
  connection: RabbitConnection,
  exchanges: string[],
): Promise<void> {
  const channel = await connection.createChannel();
  for (const exchange of [...exchanges, EXCHANGES.dlx]) {
    await channel.assertExchange(exchange, 'topic', { durable: true });
  }
  await channel.close();
}
