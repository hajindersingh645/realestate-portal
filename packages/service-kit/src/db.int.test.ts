import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createOrm, INFRA_STATEMENTS, sql, type Orm } from './db.js';
import { KitProbe } from './kit-probe.fixture.js';
import { TEST_DB_URL } from './testing.js';

let orm: Orm;

beforeAll(async () => {
  orm = await createOrm({ clientUrl: TEST_DB_URL, schema: 'kit_test', entities: [KitProbe] });
  const em = orm.em.fork();
  for (const statement of INFRA_STATEMENTS) await sql(em, statement);
  await sql(em, 'create table if not exists kit_probe (id uuid primary key, note text not null)');
});

beforeEach(async () => {
  await sql(orm.em.fork(), 'truncate kit_probe, outbox_events, inbox_events');
});

afterAll(async () => {
  await orm.close();
});

test('INFRA_STATEMENTS, when run twice, do not fail', async () => {
  const em = orm.em.fork();

  for (const statement of INFRA_STATEMENTS) await sql(em, statement);

  const rows = await sql<{ n: string }>(em, 'select count(*) as n from outbox_events');
  expect(Number(rows[0]?.n)).toBe(0);
});

test('an entity with decorators, when persisted and reloaded, round-trips', async () => {
  const em = orm.em.fork();
  const probe = new KitProbe();
  probe.note = 'hello';
  em.persist(probe);
  await em.flush();

  const found = await orm.em.fork().findOne(KitProbe, { id: probe.id });

  expect(found?.note).toBe('hello');
});

test('sql, inside a transaction that throws, is rolled back with it', async () => {
  const id = randomUUID();

  await expect(
    orm.em.fork().transactional(async (em) => {
      await sql(em, 'insert into kit_probe (id, note) values (?, ?)', [id, 'doomed']);
      throw new Error('boom');
    }),
  ).rejects.toThrow('boom');

  const rows = await sql(orm.em.fork(), 'select id from kit_probe where id = ?', [id]);
  expect(rows).toHaveLength(0);
});

test('the service role, when it touches another schema, is refused by the database', async () => {
  await expect(sql(orm.em.fork(), 'create table catalog.intruder (i int)')).rejects.toThrow(
    /permission denied/,
  );
});
