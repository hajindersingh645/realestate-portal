import { sql, type Orm } from '@hanu/service-kit';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createCatalogOrm } from '../../orm.js';
import { createLocation } from '../locations/locations.service.js';
import { createLookup, deleteLookup, updateLookup } from '../lookups/lookups.service.js';
import { createPropertyType } from '../property-types/property-types.service.js';
import { createUnitConversion } from '../unit-conversions/unit-conversions.service.js';
import { getReference } from './reference.service.js';

const DB_URL =
  process.env.TEST_CATALOG_DATABASE_URL ??
  'postgresql://svc_catalog:svc_catalog@localhost:5433/real_estate_test';
const P = { service: 'catalog-service', userId: null, ip: null };
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

test('getReference, with one row of each kind, returns them all with the platform settings', async () => {
  const marla = await createLookup(
    orm.em.fork(),
    { group: 'area_unit', code: 'marla', label: 'Marla' },
    P,
  );
  await createPropertyType(orm.em.fork(), { slug: 'flat', name: 'Flat', kind: 'flat' }, P);
  await createLocation(
    orm.em.fork(),
    { type: 'state', name: 'Punjab', slug: 'punjab', code: 'PB' },
    P,
  );
  await createUnitConversion(orm.em.fork(), { unitId: marla.id, factor: 225 }, P);

  const reference = await getReference(orm.em.fork(), platform);

  expect(reference.platform).toEqual(platform);
  expect(reference.lookups.map((lookup) => lookup.code)).toEqual(['marla']);
  expect(reference.propertyTypes.map((type) => type.slug)).toEqual(['flat']);
  expect(reference.locations.map((location) => location.slug)).toEqual(['punjab']);
  expect(reference.unitConversions.map((conversion) => conversion.factor)).toEqual([225]);
});

test('getReference, when a lookup is deactivated, leaves it out', async () => {
  const active = await createLookup(
    orm.em.fork(),
    { group: 'bhk', code: '2_bhk', label: '2 BHK' },
    P,
  );
  const retired = await createLookup(
    orm.em.fork(),
    { group: 'bhk', code: '9_bhk', label: '9 BHK' },
    P,
  );
  await updateLookup(orm.em.fork(), retired.id, { isActive: false }, P);

  const reference = await getReference(orm.em.fork(), platform);

  expect(reference.lookups.map((lookup) => lookup.id)).toEqual([active.id]);
});

test('getReference, when a lookup is deleted, leaves it out', async () => {
  const kept = await createLookup(
    orm.em.fork(),
    { group: 'bhk', code: '2_bhk', label: '2 BHK' },
    P,
  );
  const mistake = await createLookup(
    orm.em.fork(),
    { group: 'bhk', code: '22_bhk', label: '22 BHK' },
    P,
  );
  await deleteLookup(orm.em.fork(), mistake.id, P);

  const reference = await getReference(orm.em.fork(), platform);

  expect(reference.lookups.map((lookup) => lookup.id)).toEqual([kept.id]);
});

test('getReference, with an empty catalog, returns empty lists and not an error', async () => {
  const reference = await getReference(orm.em.fork(), platform);

  expect(reference).toEqual({
    platform,
    locations: [],
    propertyTypes: [],
    lookups: [],
    unitConversions: [],
  });
});
