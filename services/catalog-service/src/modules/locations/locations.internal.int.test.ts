import { sql, type Orm } from '@hanu/service-kit';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createCatalogOrm } from '../../orm.js';
import { lookupLocations } from './locations.service.js';

const DB_URL =
  process.env.TEST_CATALOG_DATABASE_URL ??
  'postgresql://svc_catalog:svc_catalog@localhost:5433/real_estate_test';

let orm: Orm;

beforeAll(async () => {
  orm = await createCatalogOrm(DB_URL, 'catalog');
  await orm.migrator.up();
});

beforeEach(async () => {
  await sql(orm.em.fork(), 'truncate locations, unit_conversions, outbox_events cascade');
});

afterAll(async () => {
  await orm.close();
});

async function insert(
  type: string,
  parentId: string | null,
  parentType: string | null,
  active = true,
): Promise<string> {
  const id = randomUUID();
  await sql(
    orm.em.fork(),
    `insert into locations (id, type, parent_id, parent_type, name, slug, is_active, sort, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, 0, now(), now())`,
    [id, type, parentId, parentType, `n-${id}`, `s-${id}`, active],
  );
  return id;
}

test('lookupLocations, for a state, a city and a locality, gives each its city id (null for the state)', async () => {
  const state = await insert('state', null, null);
  const city = await insert('city', state, 'state');
  const locality = await insert('locality', city, 'city', false);

  const rows = await lookupLocations(orm.em.fork(), [state, city, locality]);

  expect(new Map(rows.map((r) => [r.id, r]))).toEqual(
    new Map([
      [state, { id: state, type: 'state', cityId: null, isActive: true }],
      [city, { id: city, type: 'city', cityId: city, isActive: true }],
      [locality, { id: locality, type: 'locality', cityId: city, isActive: false }],
    ]),
  );
});

test('lookupLocations, for an unknown or deleted id, leaves it out', async () => {
  const state = await insert('state', null, null);
  const gone = await insert('state', null, null);
  await sql(orm.em.fork(), 'update locations set deleted_at = now() where id = ?', [gone]);

  const rows = await lookupLocations(orm.em.fork(), [state, gone, randomUUID()]);

  expect(rows.map((r) => r.id)).toEqual([state]);
});
