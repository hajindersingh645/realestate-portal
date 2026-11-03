import { sql, type Orm } from '@hanu/service-kit';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { getReference } from '../modules/reference/reference.service.js';
import { createCatalogOrm } from '../orm.js';
import { runSeed } from './run-seed.js';
import { TRICITY_SEED } from './tricity.js';

const DB_URL =
  process.env.TEST_CATALOG_DATABASE_URL ??
  'postgresql://svc_catalog:svc_catalog@localhost:5433/real_estate_test';
const P = 'catalog-service';
const platform = {
  country: 'IN',
  currency: 'INR',
  locale: 'en-IN',
  timezone: 'Asia/Kolkata',
  areaBaseUnit: 'sqft',
};

let orm: Orm;

beforeAll(async () => {
  orm = await createCatalogOrm(DB_URL, 'catalog');
  await orm.migrator.up();
});

beforeEach(async () => {
  await sql(
    orm.em.fork(),
    'truncate unit_conversions, locations, lookups, property_types, outbox_events cascade',
  );
});

afterAll(async () => {
  await orm.close();
});

const cityCount = TRICITY_SEED.states.reduce((sum, state) => sum + state.cities.length, 0);
const localityCount = TRICITY_SEED.states.reduce(
  (sum, state) => sum + state.cities.reduce((inner, city) => inner + city.localities.length, 0),
  0,
);
const expected = {
  locations: TRICITY_SEED.states.length + cityCount + localityCount,
  propertyTypes: TRICITY_SEED.propertyTypes.length,
  lookups: TRICITY_SEED.lookups.length,
  unitConversions: TRICITY_SEED.unitConversions.length,
};

async function seed(): Promise<Awaited<ReturnType<typeof runSeed>>> {
  return await orm.em.fork().transactional((em) => runSeed(em, P));
}

test('runSeed, on an empty catalog, inserts everything and one reference.changed event', async () => {
  const result = await seed();

  expect(result).toEqual(expected);
  const reference = await getReference(orm.em.fork(), platform);
  expect(reference.locations.filter((location) => location.type === 'city')).toHaveLength(6);
  expect(reference.locations.filter((location) => location.type === 'state')).toHaveLength(3);
  expect(
    await sql(
      orm.em.fork(),
      "select id from outbox_events where routing_key = 'reference.changed'",
    ),
  ).toHaveLength(1);
});

test('runSeed, run a second time, inserts nothing and emits nothing', async () => {
  await seed();
  await sql(orm.em.fork(), 'truncate outbox_events');

  const second = await seed();

  expect(second).toEqual({ locations: 0, propertyTypes: 0, lookups: 0, unitConversions: 0 });
  expect(
    await sql(
      orm.em.fork(),
      "select id from outbox_events where routing_key = 'reference.changed'",
    ),
  ).toHaveLength(0);
});

test('runSeed, after an admin renamed a seeded row, leaves the admin edit alone', async () => {
  await seed();
  await sql(
    orm.em.fork(),
    `update lookups set label = 'Two bedroom' where "group" = 'bhk' and code = '2_bhk'`,
  );

  await seed();

  const rows = await sql<{ label: string }>(
    orm.em.fork(),
    `select label from lookups where "group" = 'bhk' and code = '2_bhk'`,
  );
  expect(rows[0]?.label).toBe('Two bedroom');
});

test('runSeed, after an admin deleted a seeded lookup and conversion, does not bring them back', async () => {
  await seed();
  await sql(
    orm.em.fork(),
    `update lookups set deleted_at = now() where "group" = 'amenity' and code = 'gym'`,
  );
  await sql(
    orm.em.fork(),
    `update unit_conversions set deleted_at = now()
     where unit_id = (select id from lookups where "group" = 'area_unit' and code = 'marla')`,
  );

  const again = await seed();

  expect(again).toEqual({ locations: 0, propertyTypes: 0, lookups: 0, unitConversions: 0 });
  const reference = await getReference(orm.em.fork(), platform);
  expect(reference.lookups.some((lookup) => lookup.code === 'gym')).toBe(false);
  expect(reference.unitConversions).toHaveLength(TRICITY_SEED.unitConversions.length - 1);
});

test('runSeed, always, places every city under the right state and sub-type under its parent', async () => {
  await seed();

  const cities = await sql<{ city: string; state: string }>(
    orm.em.fork(),
    `select c.slug as city, s.code as state from locations c join locations s on s.id = c.parent_id
      where c.type = 'city' order by c.slug`,
  );
  expect(cities).toEqual([
    { city: 'chandigarh', state: 'CH' },
    { city: 'dera-bassi', state: 'PB' },
    { city: 'kharar', state: 'PB' },
    { city: 'mohali', state: 'PB' },
    { city: 'panchkula', state: 'HR' },
    { city: 'zirakpur', state: 'PB' },
  ]);
  const shops = await sql<{ parent: string }>(
    orm.em.fork(),
    `select p.slug as parent from property_types c join property_types p on p.id = c.parent_id
      where c.slug = 'shop'`,
  );
  expect(shops[0]?.parent).toBe('commercial');
});
