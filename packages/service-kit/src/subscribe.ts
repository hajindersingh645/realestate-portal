import { EXCHANGES, isEventEnvelope, type EventEnvelope } from '@hanu/contracts';
import type { ConsumeMessage } from 'amqplib';
import { sql, type Em, type Orm } from './db.js';
import type { RabbitConnection } from './rabbit.js';

export interface SubscribeOptions<T> {
  orm: Orm;
  connection: RabbitConnection;
  queue: string;
  exchange: string;
  keys: string[];
  handler: (envelope: EventEnvelope<T>, em: Em) => Promise<void>;
  onError?: (error: unknown, eventId?: string) => void;
}

function parseEnvelope(content: Buffer): EventEnvelope | null {
  try {
    const parsed: unknown = JSON.parse(content.toString());
    return isEventEnvelope(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function subscribe<T = unknown>(
  options: SubscribeOptions<T>,
): Promise<{ close(): Promise<void> }> {
  const { queue } = options;
  const dlq = `${queue}.dlq`;
  const channel = await options.connection.createChannel();
  channel.on('error', (error: unknown) => options.onError?.(error));
  await channel.prefetch(10);

  await channel.assertExchange(options.exchange, 'topic', { durable: true });
  await channel.assertExchange(EXCHANGES.dlx, 'topic', { durable: true });
  await channel.assertQueue(dlq, { durable: true, arguments: { 'x-queue-type': 'quorum' } });
  await channel.bindQueue(dlq, EXCHANGES.dlx, queue);
  await channel.assertQueue(queue, {
    durable: true,
    arguments: {
      'x-queue-type': 'quorum',
      'x-delivery-limit': 3,
      'x-dead-letter-exchange': EXCHANGES.dlx,
      'x-dead-letter-routing-key': queue,
    },
  });
  for (const key of options.keys) await channel.bindQueue(queue, options.exchange, key);

  let closed = false;

  async function handle(message: ConsumeMessage): Promise<void> {
    const envelope = parseEnvelope(message.content);
    if (envelope === null) {
      // Retrying cannot fix a malformed message: send it straight to the dead-letter queue.
      channel.reject(message, false);
      return;
    }
    try {
      await options.orm.em.fork().transactional(async (em) => {
        const fresh = await sql(
          em,
          `insert into inbox_events (event_id, consumer) values (?, ?)
           on conflict do nothing returning event_id`,
          [envelope.eventId, queue],
        );
        if (fresh.length === 0) return; // already processed: acknowledge without running
        await options.handler(envelope as EventEnvelope<T>, em);
      });
    } catch (error: unknown) {
      options.onError?.(error, envelope.eventId);
      // reject, not nack: since RabbitMQ 4.3 only a reject counts towards x-delivery-limit.
      // A closed channel has already returned the message to the queue.
      if (!closed) channel.reject(message, true);
      return;
    }
    if (!closed) channel.ack(message); // only after the transaction has committed
  }

  await channel.consume(
    queue,
    (message) => {
      if (message !== null) void handle(message);
    },
    { noAck: false },
  );

  return {
    async close(): Promise<void> {
      closed = true;
      await channel.close();
    },
  };
}
