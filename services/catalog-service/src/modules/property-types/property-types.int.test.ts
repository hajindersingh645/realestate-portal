import { ConflictError, NotFoundError, sql, ValidationError, type Orm } from '@hanu/service-kit';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createCatalogOrm } from '../../orm.js';
import {
  createPropertyType,
  deletePropertyType,
  listPropertyTypes,
  updatePropertyType,
} from './property-types.service.js';

const DB_URL =
  process.env.TEST_CATALOG_DATABASE_URL ??
  'postgresql://svc_catalog:svc_catalog@localhost:5433/real_estate_test';
const P = 'catalog-service';

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

async function commercialWithShop(): Promise<{ parentId: string; childId: string }> {
  const parent = await createPropertyType(
    orm.em.fork(),
    { slug: 'commercial', name: 'Commercial', kind: 'commercial' },
    P,
  );
  const child = await createPropertyType(
    orm.em.fork(),
    { slug: 'shop', name: 'Shop', kind: 'commercial', parentId: parent.id },
    P,
  );
  return { parentId: parent.id, childId: child.id };
}

async function outboxCount(): Promise<number> {
  return (await sql(orm.em.fork(), 'select id from outbox_events')).length;
}

test('createPropertyType, with a parent, saves the child under it and emits an event', async () => {
  const { parentId, childId } = await commercialWithShop();

  const rows = await listPropertyTypes(orm.em.fork(), {});
  expect(rows.find((row) => row.id === childId)?.parentId).toBe(parentId);
  expect(await outboxCount()).toBe(2);
});

test('createPropertyType, when the slug is taken, throws ConflictError', async () => {
  await createPropertyType(orm.em.fork(), { slug: 'flat', name: 'Flat', kind: 'flat' }, P);

  await expect(
    createPropertyType(orm.em.fork(), { slug: 'flat', name: 'Apartment', kind: 'flat' }, P),
  ).rejects.toThrow(ConflictError);
});

test('createPropertyType, when the parent does not exist, throws ValidationError and saves nothing', async () => {
  await expect(
    createPropertyType(
      orm.em.fork(),
      { slug: 'shop', name: 'Shop', kind: 'commercial', parentId: randomUUID() },
      P,
    ),
  ).rejects.toThrow(ValidationError);

  expect(await listPropertyTypes(orm.em.fork(), {})).toHaveLength(0);
  expect(await outboxCount()).toBe(0);
});

test('the database, when given a kind outside the list, refuses the row', async () => {
  await expect(
    sql(
      orm.em.fork(),
      `insert into property_types (id, slug, name, kind, is_active, sort, created_at, updated_at)
       values (?, 'x', 'X', 'palace', true, 0, now(), now())`,
      [randomUUID()],
    ),
  ).rejects.toThrow(/property_types_kind_check/);
});

test('updatePropertyType, when deactivating, keeps the row and hides it from active-only lists', async () => {
  const created = await createPropertyType(
    orm.em.fork(),
    { slug: 'flat', name: 'Flat', kind: 'flat' },
    P,
  );

  await updatePropertyType(orm.em.fork(), created.id, { isActive: false }, P);

  expect(await listPropertyTypes(orm.em.fork(), {})).toHaveLength(1);
  expect(await listPropertyTypes(orm.em.fork(), { activeOnly: true })).toHaveLength(0);
});

test('deletePropertyType, when a live sub-type exists, throws ConflictError and keeps the parent', async () => {
  const { parentId } = await commercialWithShop();

  await expect(deletePropertyType(orm.em.fork(), parentId, P)).rejects.toThrow(ConflictError);

  expect(await listPropertyTypes(orm.em.fork(), {})).toHaveLength(2);
  expect(await outboxCount()).toBe(2);
});

test('deletePropertyType, once the sub-type is deleted, deletes the parent too', async () => {
  const { parentId, childId } = await commercialWithShop();
  await deletePropertyType(orm.em.fork(), childId, P);

  await deletePropertyType(orm.em.fork(), parentId, P);

  expect(await listPropertyTypes(orm.em.fork(), {})).toHaveLength(0);
  expect(await outboxCount()).toBe(4);
});

test('deletePropertyType, when already deleted, throws NotFoundError', async () => {
  const created = await createPropertyType(
    orm.em.fork(),
    { slug: 'flat', name: 'Flat', kind: 'flat' },
    P,
  );
  await deletePropertyType(orm.em.fork(), created.id, P);

  await expect(deletePropertyType(orm.em.fork(), created.id, P)).rejects.toThrow(NotFoundError);
});

test('createPropertyType, under a deleted parent, throws ValidationError', async () => {
  const parent = await createPropertyType(
    orm.em.fork(),
    { slug: 'commercial', name: 'Commercial', kind: 'commercial' },
    P,
  );
  await deletePropertyType(orm.em.fork(), parent.id, P);

  await expect(
    createPropertyType(
      orm.em.fork(),
      { slug: 'shop', name: 'Shop', kind: 'commercial', parentId: parent.id },
      P,
    ),
  ).rejects.toThrow(ValidationError);
});

test('createPropertyType, reusing the slug of a deleted type, throws ConflictError', async () => {
  const created = await createPropertyType(
    orm.em.fork(),
    { slug: 'flat', name: 'Flat', kind: 'flat' },
    P,
  );
  await deletePropertyType(orm.em.fork(), created.id, P);

  await expect(
    createPropertyType(orm.em.fork(), { slug: 'flat', name: 'Flat', kind: 'flat' }, P),
  ).rejects.toThrow(ConflictError);
});
