import { ConflictError, NotFoundError, sql, ValidationError, type Orm } from '@hanu/service-kit';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createCatalogOrm } from '../../orm.js';
import { createLocation, deleteLocation } from '../locations/locations.service.js';
import { createLookup } from '../lookups/lookups.service.js';
import {
  createUnitConversion,
  deleteUnitConversion,
  listUnitConversions,
  updateUnitConversion,
} from './unit-conversions.service.js';

const DB_URL =
  process.env.TEST_CATALOG_DATABASE_URL ??
  'postgresql://svc_catalog:svc_catalog@localhost:5433/real_estate_test';
const P = { service: 'catalog-service', userId: null, ip: null };

let orm: Orm;
let marlaId: string;
let bhkId: string;
let stateId: string;
let cityId: string;

beforeAll(async () => {
  orm = await createCatalogOrm(DB_URL, 'catalog');
  await orm.migrator.up();
});

beforeEach(async () => {
  await sql(orm.em.fork(), 'truncate unit_conversions, locations, lookups, outbox_events cascade');
  marlaId = (
    await createLookup(orm.em.fork(), { group: 'area_unit', code: 'marla', label: 'Marla' }, P)
  ).id;
  bhkId = (await createLookup(orm.em.fork(), { group: 'bhk', code: '2_bhk', label: '2 BHK' }, P))
    .id;
  stateId = (
    await createLocation(
      orm.em.fork(),
      { type: 'state', name: 'Punjab', slug: 'punjab', code: 'PB' },
      P,
    )
  ).id;
  cityId = (
    await createLocation(
      orm.em.fork(),
      { type: 'city', parentId: stateId, name: 'Zirakpur', slug: 'zirakpur' },
      P,
    )
  ).id;
});

afterAll(async () => {
  await orm.close();
});

test('createUnitConversion, a default and a city factor for one unit, saves both', async () => {
  await createUnitConversion(orm.em.fork(), { unitId: marlaId, factor: 225 }, P);

  await createUnitConversion(
    orm.em.fork(),
    { unitId: marlaId, locationId: cityId, factor: 272.25 },
    P,
  );

  const rows = await listUnitConversions(orm.em.fork());
  expect(rows.map((row) => row.factor).sort()).toEqual([225, 272.25]);
});

test('createUnitConversion, a second default for the same unit, throws ConflictError', async () => {
  await createUnitConversion(orm.em.fork(), { unitId: marlaId, factor: 225 }, P);

  await expect(
    createUnitConversion(orm.em.fork(), { unitId: marlaId, factor: 250 }, P),
  ).rejects.toThrow(ConflictError);
});

test('createUnitConversion, with a lookup that is not an area unit, throws ValidationError', async () => {
  await expect(
    createUnitConversion(orm.em.fork(), { unitId: bhkId, factor: 1 }, P),
  ).rejects.toThrow(ValidationError);

  expect(await listUnitConversions(orm.em.fork())).toHaveLength(0);
});

test('createUnitConversion, for a state instead of a city, throws ValidationError', async () => {
  await expect(
    createUnitConversion(orm.em.fork(), { unitId: marlaId, locationId: stateId, factor: 225 }, P),
  ).rejects.toThrow(ValidationError);
});

test('createUnitConversion, with a unit id that does not exist, throws ValidationError', async () => {
  await expect(
    createUnitConversion(orm.em.fork(), { unitId: randomUUID(), factor: 1 }, P),
  ).rejects.toThrow(ValidationError);
});

test('createUnitConversion, for a deleted city, throws ValidationError', async () => {
  await deleteLocation(orm.em.fork(), cityId, P);

  await expect(
    createUnitConversion(orm.em.fork(), { unitId: marlaId, locationId: cityId, factor: 225 }, P),
  ).rejects.toThrow(ValidationError);
});

test('the database, when given a factor of zero, refuses the row', async () => {
  await expect(
    sql(
      orm.em.fork(),
      'insert into unit_conversions (id, unit_id, factor, created_at, updated_at) values (?, ?, 0, now(), now())',
      [randomUUID(), marlaId],
    ),
  ).rejects.toThrow(/unit_conversions_factor_check/);
});

test('updateUnitConversion, with a new factor, changes it and emits an event', async () => {
  const created = await createUnitConversion(orm.em.fork(), { unitId: marlaId, factor: 225 }, P);
  await sql(orm.em.fork(), 'truncate outbox_events');

  const updated = await updateUnitConversion(orm.em.fork(), created.id, { factor: 272.25 }, P);

  expect(updated.factor).toBe(272.25);
  expect(
    await sql(
      orm.em.fork(),
      "select id from outbox_events where routing_key = 'reference.changed'",
    ),
  ).toHaveLength(1);
});

test('deleteUnitConversion, on a city override, hides it and allows adding it again', async () => {
  const override = await createUnitConversion(
    orm.em.fork(),
    { unitId: marlaId, locationId: cityId, factor: 272.25 },
    P,
  );

  await deleteUnitConversion(orm.em.fork(), override.id, P);
  await createUnitConversion(
    orm.em.fork(),
    { unitId: marlaId, locationId: cityId, factor: 250 },
    P,
  );

  const rows = await listUnitConversions(orm.em.fork());
  expect(rows.map((row) => row.factor)).toEqual([250]);
});

test('deleteUnitConversion, when already deleted, throws NotFoundError', async () => {
  const created = await createUnitConversion(orm.em.fork(), { unitId: marlaId, factor: 225 }, P);
  await deleteUnitConversion(orm.em.fork(), created.id, P);

  await expect(deleteUnitConversion(orm.em.fork(), created.id, P)).rejects.toThrow(NotFoundError);
});
