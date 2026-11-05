import { sql, type Orm } from '@hanu/service-kit';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createCatalogOrm } from '../../orm.js';
import { lookupPropertyTypes } from './property-types.service.js';

const DB_URL =
  process.env.TEST_CATALOG_DATABASE_URL ??
  'postgresql://svc_catalog:svc_catalog@localhost:5433/real_estate_test';

let orm: Orm;

beforeAll(async () => {
  orm = await createCatalogOrm(DB_URL, 'catalog');
  await orm.migrator.up();
});

beforeEach(async () => {
  await sql(orm.em.fork(), 'truncate property_types, outbox_events cascade');
});

afterAll(async () => {
  await orm.close();
});

async function insert(kind: string, active = true, deleted = false): Promise<string> {
  const id = randomUUID();
  await sql(
    orm.em.fork(),
    `insert into property_types (id, slug, name, kind, is_active, sort, created_at, updated_at, deleted_at)
     values (?, ?, ?, ?, ?, 0, now(), now(), ${deleted ? 'now()' : 'null'})`,
    [id, `s-${id}`, `n-${id}`, kind, active],
  );
  return id;
}

test('lookupPropertyTypes, for an active and an inactive type, returns both with kind and isActive', async () => {
  const flat = await insert('flat');
  const plot = await insert('plot', false);

  const rows = await lookupPropertyTypes(orm.em.fork(), [flat, plot]);

  expect(new Map(rows.map((r) => [r.id, r]))).toEqual(
    new Map([
      [flat, { id: flat, kind: 'flat', isActive: true }],
      [plot, { id: plot, kind: 'plot', isActive: false }],
    ]),
  );
});

test('lookupPropertyTypes, for an unknown or deleted id, leaves it out', async () => {
  const gone = await insert('flat', true, true);

  expect(await lookupPropertyTypes(orm.em.fork(), [gone, randomUUID()])).toEqual([]);
});
