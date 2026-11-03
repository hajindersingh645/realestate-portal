import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { withDbErrors } from './db-errors.js';
import { createOrm, sql, type Orm } from './db.js';
import { ConflictError, ValidationError } from './errors.js';
import { KitProbe } from './kit-probe.fixture.js';
import { TEST_DB_URL } from './testing.js';

let orm: Orm;

beforeAll(async () => {
  orm = await createOrm({ clientUrl: TEST_DB_URL, schema: 'kit_test', entities: [KitProbe] });
  const em = orm.em.fork();
  await sql(em, 'create table if not exists kit_probe (id uuid primary key, note text not null)');
  // Own parent table, so no other test's `truncate kit_probe` trips over a foreign key.
  await sql(em, 'create table if not exists db_errors_parent (id uuid primary key)');
  await sql(
    em,
    `create table if not exists db_errors_child (
       id uuid primary key,
       parent_id uuid not null references db_errors_parent (id),
       amount integer not null check (amount > 0)
     )`,
  );
});

beforeEach(async () => {
  await sql(orm.em.fork(), 'truncate kit_probe, db_errors_child, db_errors_parent');
});

afterAll(async () => {
  await orm.close();
});

test('withDbErrors, when an entity insert breaks a unique rule, throws ConflictError with the message', async () => {
  const id = randomUUID();
  await sql(orm.em.fork(), 'insert into kit_probe (id, note) values (?, ?)', [id, 'first']);
  const em = orm.em.fork();
  const duplicate = new KitProbe();
  duplicate.id = id;
  duplicate.note = 'second';
  em.persist(duplicate);

  const attempt = withDbErrors(() => em.flush(), { unique: 'Probe already exists' });

  await expect(attempt).rejects.toThrow(ConflictError);
  await expect(attempt).rejects.toThrow('Probe already exists');
});

test('withDbErrors, when raw SQL breaks a unique rule, throws ConflictError', async () => {
  const id = randomUUID();
  const insert = (): Promise<unknown> =>
    sql(orm.em.fork(), 'insert into kit_probe (id, note) values (?, ?)', [id, 'x']);
  await insert();

  await expect(withDbErrors(insert)).rejects.toThrow(ConflictError);
});

test('withDbErrors, when a foreign key points at nothing, throws ValidationError', async () => {
  const attempt = withDbErrors(() =>
    sql(orm.em.fork(), 'insert into db_errors_child (id, parent_id, amount) values (?, ?, ?)', [
      randomUUID(),
      randomUUID(),
      1,
    ]),
  );

  await expect(attempt).rejects.toThrow(ValidationError);
});

test('withDbErrors, when a check constraint fails, throws ValidationError', async () => {
  const parentId = randomUUID();
  await sql(orm.em.fork(), 'insert into db_errors_parent (id) values (?)', [parentId]);

  const attempt = withDbErrors(() =>
    sql(orm.em.fork(), 'insert into db_errors_child (id, parent_id, amount) values (?, ?, ?)', [
      randomUUID(),
      parentId,
      0,
    ]),
  );

  await expect(attempt).rejects.toThrow(ValidationError);
});

test('withDbErrors, when the error is something else, rethrows it unchanged', async () => {
  const attempt = withDbErrors(() => sql(orm.em.fork(), 'select * from table_that_does_not_exist'));

  await expect(attempt).rejects.not.toThrow(ConflictError);
  await expect(attempt).rejects.toThrow(/does not exist/);
});
