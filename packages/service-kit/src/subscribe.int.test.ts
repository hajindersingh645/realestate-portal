import { randomUUID } from 'node:crypto';
import type { EventEnvelope } from '@hanu/contracts';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'vitest';
import { createOrm, INFRA_STATEMENTS, sql, type Orm } from './db.js';
import { KitProbe } from './kit-probe.fixture.js';
import {
  assertExchanges,
  connectRabbit,
  type RabbitChannel,
  type RabbitConnection,
} from './rabbit.js';
import { subscribe } from './subscribe.js';
import { TEST_DB_URL, TEST_RABBIT_URL, waitFor } from './testing.js';

const EXCHANGE = 'kittest.events';
let orm: Orm;
let connection: RabbitConnection;
let channel: RabbitChannel;
let queue: string;
let subscription: { close(): Promise<void> } | undefined;

beforeAll(async () => {
  orm = await createOrm({ clientUrl: TEST_DB_URL, schema: 'kit_test', entities: [KitProbe] });
  const em = orm.em.fork();
  for (const statement of INFRA_STATEMENTS) await sql(em, statement);
  await sql(em, 'create table if not exists kit_probe (id uuid primary key, note text not null)');
  connection = await connectRabbit(TEST_RABBIT_URL, () => undefined);
  await assertExchanges(connection, [EXCHANGE]);
  channel = await connection.createChannel();
});

beforeEach(async () => {
  await sql(orm.em.fork(), 'truncate inbox_events, kit_probe');
  queue = `kit-test.probe.${randomUUID()}`;
});

afterEach(async () => {
  await subscription?.close();
  subscription = undefined;
  await channel.deleteQueue(queue);
  await channel.deleteQueue(`${queue}.dlq`);
});

afterAll(async () => {
  await channel.close();
  await connection.close();
  await orm.close();
});

function publish(eventId: string, payload: object = { n: 1 }): void {
  const envelope = {
    eventId,
    timestamp: new Date().toISOString(),
    producer: 'kit-test',
    payload,
  };
  channel.publish(EXCHANGE, 'probe.created', Buffer.from(JSON.stringify(envelope)), {
    persistent: true,
  });
}

async function waitForDeadLetter(): Promise<string> {
  let content = '';
  await waitFor(async () => {
    const message = await channel.get(`${queue}.dlq`, { noAck: true });
    if (message === false) return false;
    content = message.content.toString();
    return true;
  });
  return content;
}

test('subscribe, when an event arrives, runs the handler with the envelope', async () => {
  const seen: unknown[] = [];
  subscription = await subscribe<{ n: number }>({
    orm,
    connection,
    queue,
    exchange: EXCHANGE,
    keys: ['probe.created'],
    handler: (envelope) => {
      seen.push(envelope.payload);
      return Promise.resolve();
    },
  });
  const eventId = randomUUID();

  publish(eventId);

  await waitFor(() => seen.length === 1);
  expect(seen[0]).toEqual({ n: 1 });
});

test('subscribe, when the same eventId is delivered twice, runs the handler once', async () => {
  let calls = 0;
  subscription = await subscribe({
    orm,
    connection,
    queue,
    exchange: EXCHANGE,
    keys: ['probe.created'],
    handler: () => {
      calls += 1;
      return Promise.resolve();
    },
  });
  const eventId = randomUUID();

  publish(eventId);
  publish(eventId);
  publish(randomUUID());

  await waitFor(() => calls === 2);
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(calls).toBe(2);
});

test('subscribe, when the handler always throws, dead-letters the event and rolls back its writes', async () => {
  let attempts = 0;
  const probeId = randomUUID();
  subscription = await subscribe({
    orm,
    connection,
    queue,
    exchange: EXCHANGE,
    keys: ['probe.created'],
    handler: async (_envelope, em) => {
      attempts += 1;
      await sql(em, 'insert into kit_probe (id, note) values (?, ?)', [probeId, 'partial']);
      throw new Error('handler failed');
    },
  });
  const eventId = randomUUID();

  publish(eventId);

  const dead = await waitForDeadLetter();
  expect((JSON.parse(dead) as EventEnvelope).eventId).toBe(eventId);
  expect(attempts).toBe(4); // the first delivery plus x-delivery-limit (3) retries
  const em = orm.em.fork();
  expect(await sql(em, 'select id from kit_probe where id = ?', [probeId])).toHaveLength(0);
  expect(
    await sql(em, 'select event_id from inbox_events where event_id = ?', [eventId]),
  ).toHaveLength(0);
});

test('subscribe, when a message is not a valid envelope, dead-letters it at once and keeps serving', async () => {
  const seen: string[] = [];
  subscription = await subscribe({
    orm,
    connection,
    queue,
    exchange: EXCHANGE,
    keys: ['probe.created'],
    handler: (envelope) => {
      seen.push(envelope.eventId);
      return Promise.resolve();
    },
  });
  const goodId = randomUUID();

  channel.publish(EXCHANGE, 'probe.created', Buffer.from('this is not json'));
  publish(goodId);

  await waitFor(() => seen.length === 1);
  expect(seen).toEqual([goodId]);
  const dead = await waitForDeadLetter();
  expect(dead).toBe('this is not json');
});
