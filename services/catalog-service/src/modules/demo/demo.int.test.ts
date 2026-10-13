import {
  assertExchanges,
  connectRabbit,
  sql,
  type Orm,
  type RabbitChannel,
  type RabbitConnection,
} from '@hanu/service-kit';
import { EXCHANGES, type EventEnvelope } from '@hanu/contracts';
import { TEST_RABBIT_URL, waitFor } from '@hanu/service-kit/testing';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { DEMO_QUEUE, startMessaging } from '../../messaging.js';
import { createCatalogOrm } from '../../orm.js';
import { createPing, getPing } from './demo.service.js';

const DB_URL =
  process.env.TEST_CATALOG_DATABASE_URL ??
  'postgresql://svc_catalog:svc_catalog@localhost:5433/real_estate_test';

let orm: Orm;
let connection: RabbitConnection;
let channel: RabbitChannel;
let messaging: Awaited<ReturnType<typeof startMessaging>>;

beforeAll(async () => {
  orm = await createCatalogOrm(DB_URL, 'catalog');
  await orm.migrator.up();
  connection = await connectRabbit(TEST_RABBIT_URL, () => undefined);
  await assertExchanges(connection, [EXCHANGES.catalog]);
  messaging = await startMessaging({ orm, connection, serviceName: 'catalog-service' });
  channel = await connection.createChannel();
});

beforeEach(async () => {
  await sql(orm.em.fork(), 'truncate demo_pings, outbox_events, inbox_events');
  await channel.purgeQueue(DEMO_QUEUE);
  await channel.purgeQueue(`${DEMO_QUEUE}.dlq`);
});

afterAll(async () => {
  await messaging.stop();
  await channel.close();
  await connection.close();
  await orm.close();
});

test('a ping, once the relay runs, is received by the consumer exactly once', async () => {
  const id = await createPing(orm.em.fork(), { note: 'hello', fail: false }, 'catalog-service');
  expect((await getPing(orm.em.fork(), id)).receivedAt).toBeUndefined();

  await messaging.relay.tick();

  await waitFor(async () => (await getPing(orm.em.fork(), id)).receivedAt !== undefined);
  const inbox = await sql(orm.em.fork(), 'select event_id from inbox_events');
  expect(inbox).toHaveLength(1);
});

test('a ping marked to fail, once the relay runs, ends in the dead-letter queue', async () => {
  const id = await createPing(orm.em.fork(), { note: 'bad', fail: true }, 'catalog-service');

  await messaging.relay.tick();

  let dead = '';
  await waitFor(async () => {
    const message = await channel.get(`${DEMO_QUEUE}.dlq`, { noAck: true });
    if (message === false) return false;
    dead = message.content.toString();
    return true;
  });
  expect((JSON.parse(dead) as EventEnvelope).payload).toEqual({ pingId: id, fail: true });
  expect((await getPing(orm.em.fork(), id)).receivedAt).toBeUndefined();
});
