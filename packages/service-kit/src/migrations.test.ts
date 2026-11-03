import { expect, test } from 'vitest';
import { INFRA_TABLES, stripSchema } from './migrations.js';

test('stripSchema, when a statement names the schema, removes every prefix', () => {
  const sql =
    'alter table "catalog"."lookups" add constraint "x" foreign key ("a") references "catalog"."lookups" ("id");';

  const result = stripSchema(sql, 'catalog');

  expect(result).toBe(
    'alter table "lookups" add constraint "x" foreign key ("a") references "lookups" ("id");',
  );
});

test('stripSchema, when the schema does not appear, returns the statement unchanged', () => {
  expect(stripSchema('create table "lookups" ("id" uuid);', 'catalog')).toBe(
    'create table "lookups" ("id" uuid);',
  );
});

test('stripSchema, when a column happens to be named like the schema, leaves it alone', () => {
  expect(stripSchema('select "catalog" from "catalog"."t";', 'catalog')).toBe(
    'select "catalog" from "t";',
  );
});

test('INFRA_TABLES, as a list, names the five shared tables', () => {
  expect([...INFRA_TABLES].sort()).toEqual([
    'idempotency_keys',
    'inbox_events',
    'outbox_events',
    'settings',
    'state_transitions',
  ]);
});
