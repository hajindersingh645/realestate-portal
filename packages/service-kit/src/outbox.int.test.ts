import { randomUUID } from 'node:crypto';
import type { EventEnvelope } from '@hanu/contracts';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createOrm, INFRA_STATEMENTS, sql, type Orm } from './db.js';
import { KitProbe } from './kit-probe.fixture.js';
import { createOutboxRelay, outboxAdd } from './outbox.js';
import {
  assertExchanges,
  connectRabbit,
  type RabbitChannel,
  type RabbitConnection,
} from './rabbit.js';
import { TEST_DB_URL, TEST_RABBIT_URL } from './testing.js';

const EXCHANGE = 'kittest.events';
let orm: Orm;
let connection: RabbitConnection;
let channel: RabbitChannel;
let queue: string;

beforeAll(async () => {
  orm = await createOrm({ clientUrl: TEST_DB_URL, schema: 'kit_test', entities: [KitProbe] });
  const em = orm.em.fork();
  for (const statement of INFRA_STATEMENTS) await sql(em, statement);
  connection = await connectRabbit(TEST_RABBIT_URL, () => undefined);
  await assertExchanges(connection, [EXCHANGE]);
  channel = await connection.createChannel();
});

beforeEach(async () => {
  await sql(orm.em.fork(), 'truncate outbox_events');
  const declared = await channel.assertQueue('', { exclusive: true });
  queue = declared.queue;
  await channel.bindQueue(queue, EXCHANGE, 'probe.#');
});

afterAll(async () => {
  await channel.close();
  await connection.close();
  await orm.close();
});

function event(routingKey = 'probe.created', exchange = EXCHANGE) {
  return { exchange, routingKey, producer: 'kit-test', payload: { n: 1 } };
}

test('outboxAdd, when its transaction rolls back, leaves no event', async () => {
  await expect(
    orm.em.fork().transactional(async (em) => {
      await outboxAdd(em, event());
      throw new Error('boom');
    }),
  ).rejects.toThrow('boom');

  const rows = await sql(orm.em.fork(), 'select id from outbox_events');
  expect(rows).toHaveLength(0);
});

test('relay.tick, with one unsent event, publishes the envelope and marks it sent', async () => {
  const eventId = await orm.em.fork().transactional((em) => outboxAdd(em, event()));
  const relay = createOutboxRelay({ orm, connection });

  const published = await relay.tick();
  await relay.stop();

  expect(published).toBe(1);
  const message = await channel.get(queue, { noAck: true });
  expect(message).not.toBe(false);
  if (message === false) return;
  const envelope = JSON.parse(message.content.toString()) as EventEnvelope;
  expect(Object.keys(envelope).sort()).toEqual(['eventId', 'payload', 'producer', 'timestamp']);
  expect(envelope.eventId).toBe(eventId);
  expect(envelope.payload).toEqual({ n: 1 });
  expect(message.fields.routingKey).toBe('probe.created');
  const rows = await sql<{ sent_at: Date | null }>(
    orm.em.fork(),
    'select sent_at from outbox_events',
  );
  expect(rows[0]?.sent_at).not.toBeNull();
});

test('relay.tick, called again after everything is sent, publishes nothing', async () => {
  await orm.em.fork().transactional((em) => outboxAdd(em, event()));
  const relay = createOutboxRelay({ orm, connection });
  await relay.tick();

  const second = await relay.tick();
  await relay.stop();

  expect(second).toBe(0);
});

test('relay.tick, when the broker rejects the publish, leaves the event unsent and recovers', async () => {
  const badId = await orm.em
    .fork()
    .transactional((em) => outboxAdd(em, event('probe.created', `missing.${randomUUID()}`)));
  const relay = createOutboxRelay({ orm, connection });

  await expect(relay.tick()).rejects.toThrow();

  const stuck = await sql<{ sent_at: Date | null }>(
    orm.em.fork(),
    'select sent_at from outbox_events where id = ?',
    [badId],
  );
  expect(stuck[0]?.sent_at).toBeNull();

  await sql(orm.em.fork(), 'delete from outbox_events where id = ?', [badId]);
  await orm.em.fork().transactional((em) => outboxAdd(em, event()));
  expect(await relay.tick()).toBe(1);
  await relay.stop();
});
