import type { AuditRecordedPayload, EventEnvelope } from '@hanu/contracts';
import { sql, type Orm } from '@hanu/service-kit';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createIdentityOrm } from '../../orm.js';
import { listAuditLogs, recordAudit } from './audit-logs.service.js';
import { syncPermissions } from '../../permissions-sync.js';

const DB_URL =
  process.env.TEST_IDENTITY_DATABASE_URL ??
  'postgresql://svc_identity:svc_identity@localhost:5433/real_estate_test';

let orm: Orm;

beforeAll(async () => {
  orm = await createIdentityOrm(DB_URL, 'identity');
  await orm.migrator.up();
  await orm.em.fork().transactional((em) => syncPermissions(em));
});

beforeEach(async () => {
  await sql(orm.em.fork(), 'truncate audit_logs');
});

afterAll(async () => {
  await orm.close();
});

function envelope(
  overrides: Partial<AuditRecordedPayload> = {},
  timestamp = new Date().toISOString(),
): EventEnvelope<AuditRecordedPayload> {
  return {
    eventId: randomUUID(),
    timestamp,
    producer: 'catalog-service',
    payload: {
      actorUserId: randomUUID(),
      service: 'catalog-service',
      action: 'lookup.updated',
      targetType: 'lookup',
      targetId: randomUUID(),
      diff: { before: { label: 'A' }, after: { label: 'B' } },
      ip: '127.0.0.1',
      ...overrides,
    },
  };
}

test('recordAudit, for the same event delivered twice, stores one row', async () => {
  const event = envelope();

  await recordAudit(orm.em.fork(), event);
  await recordAudit(orm.em.fork(), event);

  const { data } = await listAuditLogs(orm.em.fork(), {});
  expect(data).toHaveLength(1);
  expect(data[0]).toMatchObject({ action: 'lookup.updated', diff: { after: { label: 'B' } } });
});

test('listAuditLogs, filtered by target, returns only that target newest first', async () => {
  const targetId = randomUUID();
  await recordAudit(
    orm.em.fork(),
    envelope({ targetId, action: 'lookup.created' }, '2026-11-01T10:00:00.000Z'),
  );
  await recordAudit(
    orm.em.fork(),
    envelope({ targetId, action: 'lookup.updated' }, '2026-11-02T10:00:00.000Z'),
  );
  await recordAudit(orm.em.fork(), envelope());

  const { data } = await listAuditLogs(orm.em.fork(), { targetType: 'lookup', targetId });

  expect(data.map((row) => row.action)).toEqual(['lookup.updated', 'lookup.created']);
});

test('listAuditLogs, with more than one page, pages with nextCursor without gaps or repeats', async () => {
  const actorUserId = randomUUID();
  for (let i = 0; i < 55; i += 1) {
    await recordAudit(
      orm.em.fork(),
      envelope({ actorUserId }, new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString()),
    );
  }

  const first = await listAuditLogs(orm.em.fork(), { actorUserId });
  const second = await listAuditLogs(orm.em.fork(), {
    actorUserId,
    cursor: first.nextCursor ?? '',
  });

  expect(first.data).toHaveLength(50);
  expect(second.data).toHaveLength(5);
  expect(second.nextCursor).toBeNull();
  const ids = [...first.data, ...second.data].map((row) => row.id);
  expect(new Set(ids).size).toBe(55);
});
