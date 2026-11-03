import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import {
  appendOnlySql,
  createOrm,
  GRANT_RUNTIME_SQL,
  INFRA_STATEMENTS,
  sql,
  type Orm,
} from './db.js';
import { KitProbe } from './kit-probe.fixture.js';
import { TEST_APP_DB_URL, TEST_DB_URL } from './testing.js';

let orm: Orm;
let appOrm: Orm;

beforeAll(async () => {
  orm = await createOrm({ clientUrl: TEST_DB_URL, schema: 'kit_test', entities: [KitProbe] });
  const em = orm.em.fork();
  for (const statement of INFRA_STATEMENTS) await sql(em, statement);
  await sql(em, 'create table if not exists kit_probe (id uuid primary key, note text not null)');
  await sql(em, GRANT_RUNTIME_SQL); // kit_probe may predate the default privileges
  await sql(em, appendOnlySql(['settings', 'state_transitions']));
  appOrm = await createOrm({
    clientUrl: TEST_APP_DB_URL,
    schema: 'kit_test',
    entities: [KitProbe],
  });
});

beforeEach(async () => {
  await sql(orm.em.fork(), 'truncate kit_probe, outbox_events, inbox_events');
});

afterAll(async () => {
  await appOrm.close();
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

test('the runtime role, on an ordinary table, can insert, update and delete', async () => {
  const em = appOrm.em.fork();
  const id = randomUUID();

  await sql(em, 'insert into kit_probe (id, note) values (?, ?)', [id, 'a']);
  await sql(em, 'update kit_probe set note = ? where id = ?', ['b', id]);
  await sql(em, 'delete from kit_probe where id = ?', [id]);

  expect(await sql(em, 'select id from kit_probe where id = ?', [id])).toHaveLength(0);
});

test('the runtime role, on settings, can add a version but not change or delete one', async () => {
  const em = appOrm.em.fork();
  const key = `probe.${randomUUID()}`;

  await sql(em, 'insert into settings (key, version, value) values (?, 1, ?)', [key, '1']);

  await expect(sql(em, 'update settings set value = ? where key = ?', ['2', key])).rejects.toThrow(
    /permission denied/,
  );
  await expect(sql(em, 'delete from settings where key = ?', [key])).rejects.toThrow(
    /permission denied/,
  );
  await expect(sql(em, 'truncate settings')).rejects.toThrow(/permission denied/);
  const rows = await sql<{ value: unknown }>(em, 'select value from settings where key = ?', [key]);
  expect(rows).toEqual([{ value: 1 }]);
});

test('the runtime role, on state_transitions, cannot change or delete a row', async () => {
  const em = appOrm.em.fork();

  await expect(sql(em, "update state_transitions set reason = 'x'")).rejects.toThrow(
    /permission denied/,
  );
  await expect(sql(em, 'delete from state_transitions')).rejects.toThrow(/permission denied/);
});
