import { randomUUID } from 'node:crypto';
import type { EventEnvelope } from '@hanu/contracts';
import { sql, type Em, type Orm } from './db.js';
import type { RabbitConfirmChannel, RabbitConnection } from './rabbit.js';

export interface OutboxEvent {
  exchange: string;
  routingKey: string;
  producer: string;
  payload: object;
}

/** Records an event in the caller's transaction. It is published only if that transaction commits. */
export async function outboxAdd(em: Em, event: OutboxEvent): Promise<string> {
  const envelope: EventEnvelope<object> = {
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    producer: event.producer,
    payload: event.payload,
  };
  await sql(
    em,
    'insert into outbox_events (id, exchange, routing_key, envelope) values (?, ?, ?, ?::jsonb)',
    [envelope.eventId, event.exchange, event.routingKey, JSON.stringify(envelope)],
  );
  return envelope.eventId;
}

interface OutboxRow {
  id: string;
  exchange: string;
  routing_key: string;
  envelope: EventEnvelope;
}

export interface OutboxRelayOptions {
  orm: Orm;
  connection: RabbitConnection;
  intervalMs?: number;
  batchSize?: number;
  onError?: (error: unknown) => void;
}

export function createOutboxRelay(options: OutboxRelayOptions) {
  const intervalMs = options.intervalMs ?? 1000;
  const batchSize = options.batchSize ?? 100;
  let channel: RabbitConfirmChannel | null = null;
  let timer: NodeJS.Timeout | null = null;
  let running = false;

  async function openChannel(): Promise<RabbitConfirmChannel> {
    const opened = await options.connection.createConfirmChannel();
    const drop = (): void => {
      channel = null;
    };
    opened.on('error', drop);
    opened.on('close', drop);
    return opened;
  }

  // ponytail: rows are published oldest-first, so one event the broker keeps rejecting blocks
  // the ones behind it. Exchanges are declared at boot, so this means a deployment mistake;
  // add a per-row attempt counter if it ever happens in practice.
  async function tick(): Promise<number> {
    channel ??= await openChannel();
    const active = channel;
    return await options.orm.em.fork().transactional(async (em) => {
      const rows = await sql<OutboxRow>(
        em,
        `select id, exchange, routing_key, envelope from outbox_events
          where sent_at is null order by created_at limit ? for update skip locked`,
        [batchSize],
      );
      if (rows.length === 0) return 0;
      for (const row of rows) {
        active.publish(row.exchange, row.routing_key, Buffer.from(JSON.stringify(row.envelope)), {
          persistent: true,
          contentType: 'application/json',
          messageId: row.id,
          type: row.routing_key,
        });
      }
      await active.waitForConfirms();
      for (const row of rows) {
        await sql(em, 'update outbox_events set sent_at = now() where id = ?', [row.id]);
      }
      return rows.length;
    });
  }

  function schedule(): void {
    timer = setTimeout(() => {
      void tick()
        .catch((error: unknown) => options.onError?.(error))
        .finally(() => {
          if (running) schedule();
        });
    }, intervalMs);
  }

  return {
    tick,
    start(): void {
      running = true;
      schedule();
    },
    async stop(): Promise<void> {
      running = false;
      if (timer !== null) clearTimeout(timer);
      const open = channel;
      channel = null;
      if (open !== null) await open.close();
    },
  };
}
