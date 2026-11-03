import { ConflictError, NotFoundError, sql, ValidationError, type Orm } from '@hanu/service-kit';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createCatalogOrm } from '../../orm.js';
import {
  createLocation,
  deleteLocation,
  listLocations,
  updateLocation,
  type LocationView,
} from './locations.service.js';

const DB_URL =
  process.env.TEST_CATALOG_DATABASE_URL ??
  'postgresql://svc_catalog:svc_catalog@localhost:5433/real_estate_test';
const P = { service: 'catalog-service', userId: null, ip: null };

let orm: Orm;

beforeAll(async () => {
  orm = await createCatalogOrm(DB_URL, 'catalog');
  await orm.migrator.up();
});

beforeEach(async () => {
  await sql(orm.em.fork(), 'truncate locations, outbox_events cascade');
});

afterAll(async () => {
  await orm.close();
});

async function state(slug = 'punjab', code = 'PB'): Promise<LocationView> {
  return await createLocation(orm.em.fork(), { type: 'state', name: slug, slug, code }, P);
}

async function cityIn(parentId: string, slug = 'zirakpur'): Promise<LocationView> {
  return await createLocation(orm.em.fork(), { type: 'city', parentId, name: slug, slug }, P);
}

async function localityIn(parentId: string, slug = 'vip-road'): Promise<LocationView> {
  return await createLocation(orm.em.fork(), { type: 'locality', parentId, name: slug, slug }, P);
}

async function outboxCount(): Promise<number> {
  return (
    await sql(orm.em.fork(), "select id from outbox_events where routing_key = 'reference.changed'")
  ).length;
}

test('createLocation, building state then city then locality, saves the chain and three events', async () => {
  const punjab = await state();
  const zirakpur = await cityIn(punjab.id);

  const vipRoad = await localityIn(zirakpur.id);

  expect(vipRoad.parentId).toBe(zirakpur.id);
  expect(await listLocations(orm.em.fork(), { parentId: punjab.id })).toHaveLength(1);
  expect(await outboxCount()).toBe(3);
});

test('createLocation, a locality directly under a state, throws ValidationError', async () => {
  const punjab = await state();

  await expect(localityIn(punjab.id, 'x')).rejects.toThrow(ValidationError);

  expect(await listLocations(orm.em.fork(), { type: 'locality' })).toHaveLength(0);
});

test('createLocation, a city under a city, throws ValidationError', async () => {
  const zirakpur = await cityIn((await state()).id);

  await expect(cityIn(zirakpur.id, 'y')).rejects.toThrow(ValidationError);
});

test('createLocation, a city with no parent, throws ValidationError', async () => {
  await expect(
    createLocation(orm.em.fork(), { type: 'city', name: 'Orphan', slug: 'orphan' }, P),
  ).rejects.toThrow(ValidationError);
});

test('createLocation, a state with a parent, throws ValidationError', async () => {
  const punjab = await state();

  await expect(
    createLocation(orm.em.fork(), { type: 'state', parentId: punjab.id, name: 'Z', slug: 'z' }, P),
  ).rejects.toThrow(ValidationError);
});

test('createLocation, a parent id that does not exist, throws ValidationError', async () => {
  await expect(cityIn(randomUUID(), 'q')).rejects.toThrow(ValidationError);
});

test('createLocation, the same city slug in two states, throws ConflictError', async () => {
  const punjab = await state('punjab', 'PB');
  const haryana = await state('haryana', 'HR');
  await cityIn(punjab.id, 'panchkula');

  await expect(cityIn(haryana.id, 'panchkula')).rejects.toThrow(ConflictError);
});

test('createLocation, the same locality slug in two cities, is allowed', async () => {
  const punjab = await state();
  const zirakpur = await cityIn(punjab.id, 'zirakpur');
  const mohali = await cityIn(punjab.id, 'mohali');

  await localityIn(zirakpur.id, 'sector-20');
  await localityIn(mohali.id, 'sector-20');

  expect(await listLocations(orm.em.fork(), { type: 'locality' })).toHaveLength(2);
});

test('createLocation, two states with the same slug, throws ConflictError', async () => {
  await state('punjab', 'PB');

  await expect(state('punjab', 'PJ')).rejects.toThrow(ConflictError);
});

test('createLocation, a state code on a city, throws ValidationError', async () => {
  const punjab = await state();

  await expect(
    createLocation(
      orm.em.fork(),
      { type: 'city', parentId: punjab.id, name: 'M', slug: 'm', code: 'MH' },
      P,
    ),
  ).rejects.toThrow(ValidationError);
});

test('updateLocation, when deactivating, keeps the row and hides it from active-only lists', async () => {
  const punjab = await state();

  await updateLocation(orm.em.fork(), punjab.id, { isActive: false }, P);

  expect(await listLocations(orm.em.fork(), {})).toHaveLength(1);
  expect(await listLocations(orm.em.fork(), { activeOnly: true })).toHaveLength(0);
});

test('deleteLocation, when a live city sits under the state, throws ConflictError and deletes nothing', async () => {
  const punjab = await state();
  await cityIn(punjab.id);

  await expect(deleteLocation(orm.em.fork(), punjab.id, P)).rejects.toThrow(ConflictError);

  expect(await listLocations(orm.em.fork(), {})).toHaveLength(2);
  expect(await outboxCount()).toBe(2);
});

test('deleteLocation, bottom-up, removes the whole chain from every list', async () => {
  const punjab = await state();
  const zirakpur = await cityIn(punjab.id);
  const vipRoad = await localityIn(zirakpur.id);

  await deleteLocation(orm.em.fork(), vipRoad.id, P);
  await deleteLocation(orm.em.fork(), zirakpur.id, P);
  await deleteLocation(orm.em.fork(), punjab.id, P);

  expect(await listLocations(orm.em.fork(), {})).toHaveLength(0);
  expect(await outboxCount()).toBe(6);
});

test('deleteLocation, when already deleted, throws NotFoundError', async () => {
  const punjab = await state();
  await deleteLocation(orm.em.fork(), punjab.id, P);

  await expect(deleteLocation(orm.em.fork(), punjab.id, P)).rejects.toThrow(NotFoundError);
});

test('createLocation, under a deleted city, throws ValidationError', async () => {
  const zirakpur = await cityIn((await state()).id);
  await deleteLocation(orm.em.fork(), zirakpur.id, P);

  await expect(localityIn(zirakpur.id)).rejects.toThrow(ValidationError);
});

test('createLocation, reusing the slug of a deleted city, throws ConflictError', async () => {
  const punjab = await state();
  const zirakpur = await cityIn(punjab.id);
  await deleteLocation(orm.em.fork(), zirakpur.id, P);

  await expect(cityIn(punjab.id, 'zirakpur')).rejects.toThrow(ConflictError);
});
