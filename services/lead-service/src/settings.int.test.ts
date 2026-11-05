import { getSetting, sql, type Orm } from '@hanu/service-kit';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { createLeadOrm } from './orm.js';

const DB_URL =
  process.env.TEST_LEAD_DATABASE_URL ??
  'postgresql://svc_lead:svc_lead@localhost:5433/real_estate_test';

let orm: Orm;

beforeAll(async () => {
  orm = await createLeadOrm(DB_URL, 'lead');
  await orm.migrator.up();
});

afterAll(async () => {
  await orm.close();
});

test('getSetting, after migrate, returns the seeded lead settings', async () => {
  const em = orm.em.fork();

  expect(await getSetting(em, 'requirement.freeQuota')).toEqual({ count: 1, window: 'lifetime' });
  expect(await getSetting(em, 'requirement.validityDays')).toBe(60);
  expect(await getSetting(em, 'lead.maxUnlocks')).toBe(5);
  expect(await getSetting(em, 'lead.unlock.free')).toBe(true);
});

test('getSetting, after a newer version is added, returns the newer value', async () => {
  const em = orm.em.fork();
  const [row] = await sql<{ v: number }>(
    em,
    `select max(version) + 1 as v from settings where key = 'lead.maxUnlocks'`,
  );
  await sql(em, `insert into settings (key, version, value) values ('lead.maxUnlocks', ?, '4')`, [
    row?.v,
  ]);

  expect(await getSetting(em, 'lead.maxUnlocks')).toBe(4);

  // settings is append-only for the runtime role; the owner role used here can tidy up.
  await sql(em, `delete from settings where key = 'lead.maxUnlocks' and version = ?`, [row?.v]);
});

test('getSetting, for a key that does not exist, throws', async () => {
  await expect(getSetting(orm.em.fork(), 'nope')).rejects.toThrow('Missing setting: nope');
});
