import { ConflictError, sql, type Orm } from '@hanu/service-kit';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createCatalogOrm } from '../../orm.js';
import {
  currentContentBlocks,
  listContentBlocks,
  publishContentBlock,
} from './content-blocks.service.js';

const OWNER_URL =
  process.env.TEST_CATALOG_DATABASE_URL ??
  'postgresql://svc_catalog:svc_catalog@localhost:5433/real_estate_test';
const APP_URL =
  process.env.TEST_CATALOG_APP_DATABASE_URL ??
  'postgresql://svc_catalog_app:svc_catalog_app@localhost:5433/real_estate_test';
const ACTOR = { service: 'catalog-service', userId: null, ip: null };
const LINKS = [{ label: 'Privacy Policy', url: '/privacy' }];

let orm: Orm;
let appOrm: Orm;

beforeAll(async () => {
  orm = await createCatalogOrm(OWNER_URL, 'catalog');
  await orm.migrator.up();
  appOrm = await createCatalogOrm(APP_URL, 'catalog');
});

beforeEach(async () => {
  await sql(orm.em.fork(), 'truncate content_blocks, outbox_events cascade');
});

afterAll(async () => {
  await appOrm.close();
  await orm.close();
});

function publish(body: string, em = appOrm.em.fork()) {
  return publishContentBlock(em, ACTOR, {
    key: 'signup.data_notice',
    locale: 'en-IN',
    body,
    links: LINKS,
  });
}

test('publishContentBlock, three times for one key, numbers the versions 1, 2, 3 and the last is current', async () => {
  await publish('one');
  await publish('two');

  const third = await publish('three');

  expect(third.version).toBe(3);
  const current = await currentContentBlocks(appOrm.em.fork(), 'en-IN');
  expect(current['signup.data_notice']).toMatchObject({
    id: third.id,
    version: 3,
    body: 'three',
    links: LINKS,
  });
  const history = await listContentBlocks(appOrm.em.fork(), 'en-IN');
  expect(history.map((b) => b.version)).toEqual([3, 2, 1]);
});

test('publishContentBlock, for another locale, starts its own version 1 and leaves en-IN current alone', async () => {
  await publish('english');

  const hindi = await publishContentBlock(appOrm.em.fork(), ACTOR, {
    key: 'signup.data_notice',
    locale: 'hi-IN',
    body: 'hindi',
    links: [],
  });

  expect(hindi.version).toBe(1);
  expect((await currentContentBlocks(appOrm.em.fork(), 'en-IN'))['signup.data_notice']?.body).toBe(
    'english',
  );
});

test('publishContentBlock, when it succeeds, queues reference.changed and an audit entry', async () => {
  const block = await publish('one');

  const rows = await sql<{ routing_key: string; action: string | null }>(
    orm.em.fork(),
    `select routing_key, envelope->'payload'->>'action' as action from outbox_events order by created_at`,
  );
  expect(rows).toEqual([
    { routing_key: 'reference.changed', action: null },
    { routing_key: 'audit.recorded', action: 'content_block.created' },
  ]);
  expect(block.version).toBe(1);
});

test('publishContentBlock, when two staff publish at the same moment, never gives two rows one version; a lost race is a ConflictError', async () => {
  await publish('one');

  const results = await Promise.allSettled([
    publish('a', appOrm.em.fork()),
    publish('b', appOrm.em.fork()),
  ]);

  for (const r of results)
    if (r.status === 'rejected') expect(r.reason).toBeInstanceOf(ConflictError);
  const versions = await sql<{ version: number }>(
    orm.em.fork(),
    'select version from content_blocks order by version',
  );
  expect(new Set(versions.map((v) => v.version)).size).toBe(versions.length);
});

test('the catalog runtime role, on content_blocks, cannot update or delete', async () => {
  await publish('one');

  await expect(sql(appOrm.em.fork(), `update content_blocks set body = 'changed'`)).rejects.toThrow(
    /permission denied/,
  );
  await expect(sql(appOrm.em.fork(), 'delete from content_blocks')).rejects.toThrow(
    /permission denied/,
  );
});
