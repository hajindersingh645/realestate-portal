import type { AuditRecordedPayload, EventEnvelope } from '@hanu/contracts';
import { sql, type Orm } from '@hanu/service-kit';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createLookup, deleteLookup, updateLookup } from './modules/lookups/lookups.service.js';
import { createCatalogOrm } from './orm.js';

const DB_URL =
  process.env.TEST_CATALOG_DATABASE_URL ??
  'postgresql://svc_catalog:svc_catalog@localhost:5433/real_estate_test';
const actor = { service: 'catalog-service', userId: randomUUID(), ip: '10.0.0.1' };

let orm: Orm;

beforeAll(async () => {
  orm = await createCatalogOrm(DB_URL, 'catalog');
  await orm.migrator.up();
});

beforeEach(async () => {
  await sql(orm.em.fork(), 'truncate lookups, outbox_events cascade');
});

afterAll(async () => {
  await orm.close();
});

async function audits(): Promise<AuditRecordedPayload[]> {
  const rows = await sql<{ envelope: EventEnvelope<AuditRecordedPayload> }>(
    orm.em.fork(),
    "select envelope from outbox_events where routing_key = 'audit.recorded' order by created_at",
  );
  return rows.map((row) => row.envelope.payload);
}

test('a lookup, created, updated and deleted by staff, records three audit entries with who and what', async () => {
  const created = await createLookup(
    orm.em.fork(),
    { group: 'bhk', code: '9_bhk', label: '9 BHK' },
    actor,
  );
  await updateLookup(orm.em.fork(), created.id, { label: '9+ BHK' }, actor);
  await deleteLookup(orm.em.fork(), created.id, actor);

  const entries = await audits();

  expect(entries.map((e) => e.action)).toEqual([
    'lookup.created',
    'lookup.updated',
    'lookup.deleted',
  ]);
  expect(
    entries.every(
      (e) => e.actorUserId === actor.userId && e.ip === '10.0.0.1' && e.targetId === created.id,
    ),
  ).toBe(true);
  expect(entries[1]?.diff).toMatchObject({
    before: { label: '9 BHK' },
    after: { label: '9+ BHK' },
  });
});

test('a lookup write that fails, records no audit entry', async () => {
  await createLookup(orm.em.fork(), { group: 'bhk', code: '9_bhk', label: '9 BHK' }, actor);

  await expect(
    createLookup(orm.em.fork(), { group: 'bhk', code: '9_bhk', label: 'Again' }, actor),
  ).rejects.toThrow();

  expect(await audits()).toHaveLength(1);
});
