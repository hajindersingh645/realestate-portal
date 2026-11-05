import { EXCHANGES, ROUTING_KEYS, type EventEnvelope } from '@hanu/contracts';
import {
  assertExchanges,
  ConflictError,
  connectRabbit,
  createOutboxRelay,
  NotFoundError,
  sql,
  type Orm,
  type RabbitChannel,
  type RabbitConnection,
} from '@hanu/service-kit';
import { TEST_RABBIT_URL } from '@hanu/service-kit/testing';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createCatalogOrm } from '../../orm.js';
import { createLookup, deleteLookup, listLookups, updateLookup } from './lookups.service.js';

const DB_URL =
  process.env.TEST_CATALOG_DATABASE_URL ??
  'postgresql://svc_catalog:svc_catalog@localhost:5433/real_estate_test';
const P = { service: 'catalog-service', userId: null, ip: null };

let orm: Orm;
let connection: RabbitConnection;
let channel: RabbitChannel;

beforeAll(async () => {
  orm = await createCatalogOrm(DB_URL, 'catalog');
  await orm.migrator.up();
  connection = await connectRabbit(TEST_RABBIT_URL, () => undefined);
  await assertExchanges(connection, [EXCHANGES.catalog]);
  channel = await connection.createChannel();
});

beforeEach(async () => {
  await sql(orm.em.fork(), 'truncate lookups, outbox_events cascade');
});

afterAll(async () => {
  await channel.close();
  await connection.close();
  await orm.close();
});

function input(code = '2_bhk') {
  return { group: 'bhk', code, label: '2 BHK', sort: 2 };
}

async function outboxCount(): Promise<number> {
  return (
    await sql(orm.em.fork(), "select id from outbox_events where routing_key = 'reference.changed'")
  ).length;
}

test('createLookup, with new values, saves the row and one reference.changed event', async () => {
  const created = await createLookup(orm.em.fork(), input(), P);

  const rows = await listLookups(orm.em.fork(), { group: 'bhk' });
  expect(rows).toEqual([{ ...created, meta: null, isActive: true }]);
  const events = await sql<{ routing_key: string; envelope: EventEnvelope }>(
    orm.em.fork(),
    "select routing_key, envelope from outbox_events where routing_key = 'reference.changed'",
  );
  expect(events).toHaveLength(1);
  expect(events[0]?.routing_key).toBe('reference.changed');
  expect(events[0]?.envelope.payload).toEqual({ entity: 'lookup', id: created.id });
});

test('createLookup, when group and code already exist, throws ConflictError and saves nothing new', async () => {
  await createLookup(orm.em.fork(), input(), P);

  await expect(createLookup(orm.em.fork(), input(), P)).rejects.toThrow(ConflictError);

  expect(await listLookups(orm.em.fork(), {})).toHaveLength(1);
  expect(await outboxCount()).toBe(1);
});

test('createLookup, with the same code in another group, is allowed', async () => {
  await createLookup(orm.em.fork(), input('north'), P);

  await createLookup(orm.em.fork(), { ...input('north'), group: 'facing' }, P);

  expect(await listLookups(orm.em.fork(), {})).toHaveLength(2);
});

test('updateLookup, when deactivating, keeps the row and hides it from active-only lists', async () => {
  const created = await createLookup(orm.em.fork(), input(), P);

  const updated = await updateLookup(orm.em.fork(), created.id, { isActive: false }, P);

  expect(updated.isActive).toBe(false);
  expect(await listLookups(orm.em.fork(), {})).toHaveLength(1);
  expect(await listLookups(orm.em.fork(), { activeOnly: true })).toHaveLength(0);
  expect(await outboxCount()).toBe(2);
});

test('updateLookup, with an unknown id, throws NotFoundError and emits nothing', async () => {
  await expect(updateLookup(orm.em.fork(), randomUUID(), { label: 'x' }, P)).rejects.toThrow(
    NotFoundError,
  );

  expect(await outboxCount()).toBe(0);
});

test('deleteLookup, on a live row, keeps it in the table, hides it from every list and emits once', async () => {
  const created = await createLookup(orm.em.fork(), input(), P);

  await deleteLookup(orm.em.fork(), created.id, P);

  expect(await listLookups(orm.em.fork(), {})).toHaveLength(0);
  const raw = await sql<{ deleted: boolean }>(
    orm.em.fork(),
    'select deleted_at is not null as deleted from lookups where id = ?',
    [created.id],
  );
  expect(raw[0]?.deleted).toBe(true);
  expect(await outboxCount()).toBe(2);
});

test('deleteLookup, when already deleted, throws NotFoundError and emits nothing more', async () => {
  const created = await createLookup(orm.em.fork(), input(), P);
  await deleteLookup(orm.em.fork(), created.id, P);

  await expect(deleteLookup(orm.em.fork(), created.id, P)).rejects.toThrow(NotFoundError);

  expect(await outboxCount()).toBe(2);
});

test('updateLookup, on a deleted row, throws NotFoundError', async () => {
  const created = await createLookup(orm.em.fork(), input(), P);
  await deleteLookup(orm.em.fork(), created.id, P);

  await expect(updateLookup(orm.em.fork(), created.id, { label: 'x' }, P)).rejects.toThrow(
    NotFoundError,
  );
});

test('createLookup, reusing the code of a deleted row, throws ConflictError', async () => {
  const created = await createLookup(orm.em.fork(), input(), P);
  await deleteLookup(orm.em.fork(), created.id, P);

  await expect(createLookup(orm.em.fork(), input(), P)).rejects.toThrow(ConflictError);
});

test('a lookup change, once the relay runs, is published as reference.changed', async () => {
  const declared = await channel.assertQueue('', { exclusive: true });
  await channel.bindQueue(declared.queue, EXCHANGES.catalog, ROUTING_KEYS.referenceChanged);
  const created = await createLookup(orm.em.fork(), input(), P);
  const relay = createOutboxRelay({ orm, connection });

  await relay.tick();
  await relay.stop();

  const message = await channel.get(declared.queue, { noAck: true });
  expect(message).not.toBe(false);
  if (message === false) return;
  const envelope = JSON.parse(message.content.toString()) as EventEnvelope;
  expect(envelope.producer).toBe('catalog-service');
  expect(envelope.payload).toEqual({ entity: 'lookup', id: created.id });
});
