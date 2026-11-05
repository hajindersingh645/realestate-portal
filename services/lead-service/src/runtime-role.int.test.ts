import { sql, type Orm } from '@hanu/service-kit';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { createLeadOrm } from './orm.js';

const OWNER_URL =
  process.env.TEST_LEAD_DATABASE_URL ??
  'postgresql://svc_lead:svc_lead@localhost:5433/real_estate_test';
const APP_URL =
  process.env.TEST_LEAD_APP_DATABASE_URL ??
  'postgresql://svc_lead_app:svc_lead_app@localhost:5433/real_estate_test';

let appOrm: Orm;

beforeAll(async () => {
  const owner = await createLeadOrm(OWNER_URL, 'lead');
  await owner.migrator.up();
  await owner.close();
  appOrm = await createLeadOrm(APP_URL, 'lead');
});

afterAll(async () => {
  await appOrm.close();
});

test('the lead runtime role, on requirements, can insert, update and delete', async () => {
  const em = appOrm.em.fork();
  const id = randomUUID();

  await sql(
    em,
    `insert into requirements (id, buyer_id, purpose, property_type_id, budget_min, budget_max, created_at, updated_at)
     values (?, ?, 'buy', ?, 0, 100, now(), now())`,
    [id, randomUUID(), randomUUID()],
  );
  await sql(em, "update requirements set notes = 'Probe' where id = ?", [id]);
  await sql(em, 'delete from requirements where id = ?', [id]);

  expect(await sql(em, 'select id from requirements where id = ?', [id])).toHaveLength(0);
});

test('the lead runtime role, on settings, cannot update or delete', async () => {
  const em = appOrm.em.fork();

  await expect(
    sql(em, "update settings set value = '9' where key = 'lead.maxUnlocks'"),
  ).rejects.toThrow(/permission denied/);
  await expect(sql(em, "delete from settings where key = 'lead.maxUnlocks'")).rejects.toThrow(
    /permission denied/,
  );
});
