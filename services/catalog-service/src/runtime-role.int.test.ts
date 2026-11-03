import { sql, type Orm } from '@hanu/service-kit';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { createCatalogOrm } from './orm.js';

const OWNER_URL =
  process.env.TEST_CATALOG_DATABASE_URL ??
  'postgresql://svc_catalog:svc_catalog@localhost:5433/real_estate_test';
const APP_URL =
  process.env.TEST_CATALOG_APP_DATABASE_URL ??
  'postgresql://svc_catalog_app:svc_catalog_app@localhost:5433/real_estate_test';

let appOrm: Orm;

beforeAll(async () => {
  const owner = await createCatalogOrm(OWNER_URL, 'catalog');
  await owner.migrator.up();
  await owner.close();
  appOrm = await createCatalogOrm(APP_URL, 'catalog');
});

afterAll(async () => {
  await appOrm.close();
});

test('the catalog runtime role, on lookups, can insert, update and delete', async () => {
  const em = appOrm.em.fork();
  const id = randomUUID();

  await sql(
    em,
    `insert into lookups (id, "group", code, label, created_at, updated_at)
     values (?, 'bhk', ?, 'Probe', now(), now())`,
    [id, `probe_${id.slice(0, 8)}`],
  );
  await sql(em, "update lookups set label = 'Probe 2' where id = ?", [id]);
  await sql(em, 'delete from lookups where id = ?', [id]);

  expect(await sql(em, 'select id from lookups where id = ?', [id])).toHaveLength(0);
});

test('the catalog runtime role, on settings, cannot change or delete a row', async () => {
  const em = appOrm.em.fork();

  await expect(sql(em, "update settings set value = '1'")).rejects.toThrow(/permission denied/);
  await expect(sql(em, 'delete from settings')).rejects.toThrow(/permission denied/);
});

test('the catalog runtime role, when it tries to change the schema, is refused', async () => {
  await expect(sql(appOrm.em.fork(), 'create table intruder (i int)')).rejects.toThrow(
    /permission denied/,
  );
});
