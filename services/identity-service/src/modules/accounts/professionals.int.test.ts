import { NotFoundError, sql, type Orm } from '@hanu/service-kit';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createIdentityOrm } from '../../orm.js';
import { seedAccount } from './accounts.fixture.js';
import { getProfessional, listProfessionals } from './professionals.service.js';

const DB_URL =
  process.env.TEST_IDENTITY_DATABASE_URL ??
  'postgresql://svc_identity:svc_identity@localhost:5433/real_estate_test';
const MOHALI = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c01';
const SECTOR_70 = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c02';
const PANCHKULA = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c03';

let orm: Orm;

beforeAll(async () => {
  orm = await createIdentityOrm(DB_URL, 'identity');
  await orm.migrator.up();
});

beforeEach(async () => {
  await sql(
    orm.em.fork(),
    `truncate account_transitions, account_locations, account_members, accounts, users cascade`,
  );
});

afterAll(async () => {
  await orm.close();
});

const NOT_LIVE = [
  { status: 'pending' },
  { status: 'rejected' },
  { status: 'suspended' },
  { status: 'banned' },
  { status: 'approved', deleted: true },
] as const;

test('listProfessionals, among accounts in every state, returns only the approved, live ones', async () => {
  for (const seed of NOT_LIVE) await seedAccount(orm.em.fork(), seed);
  const live = await seedAccount(orm.em.fork(), { status: 'approved' });

  const page = await listProfessionals(orm.em.fork(), {});

  expect(page.data.map((p) => p.slug)).toEqual([live.slug]);
});

test.each(NOT_LIVE)(
  'getProfessional, for an account that is %o, throws NotFoundError',
  async (seed) => {
    const { slug } = await seedAccount(orm.em.fork(), seed);

    await expect(getProfessional(orm.em.fork(), slug)).rejects.toBeInstanceOf(NotFoundError);
  },
);

test('getProfessional, for an approved account, returns the public profile without owner contact', async () => {
  const { slug, accountId } = await seedAccount(orm.em.fork(), {
    status: 'approved',
    areas: [{ locationId: SECTOR_70, cityId: MOHALI }],
  });

  const profile = await getProfessional(orm.em.fork(), slug);

  expect(profile).toEqual({
    id: accountId,
    slug,
    type: 'agent',
    displayName: 'Ravi Realty',
    about: 'About',
    experienceYears: 5,
    specialisations: ['Plots'],
    licenseNumber: 'RERA-1',
    areas: [{ locationId: SECTOR_70, cityId: MOHALI }],
  });
});

test('listProfessionals, filtered by city, locality and type, returns only the matching accounts', async () => {
  const mohali = await seedAccount(orm.em.fork(), {
    status: 'approved',
    areas: [{ locationId: SECTOR_70, cityId: MOHALI }],
  });
  const panchkula = await seedAccount(orm.em.fork(), {
    status: 'approved',
    type: 'agency',
    areas: [{ locationId: PANCHKULA, cityId: PANCHKULA }],
  });

  const byCity = await listProfessionals(orm.em.fork(), { cityId: MOHALI });
  const byLocality = await listProfessionals(orm.em.fork(), { locationId: SECTOR_70 });
  const byType = await listProfessionals(orm.em.fork(), { type: 'agency' });

  expect(byCity.data.map((p) => p.slug)).toEqual([mohali.slug]);
  expect(byLocality.data.map((p) => p.slug)).toEqual([mohali.slug]);
  expect(byType.data.map((p) => p.slug)).toEqual([panchkula.slug]);
});

test('listProfessionals, with 51 approved accounts, pages 50 then 1 by cursor', async () => {
  for (let i = 0; i < 51; i += 1)
    await seedAccount(orm.em.fork(), { status: 'approved', ageSeconds: i });

  const first = await listProfessionals(orm.em.fork(), {});
  const second = await listProfessionals(orm.em.fork(), { cursor: first.nextCursor ?? '' });

  expect(first.data).toHaveLength(50);
  expect(second.data).toHaveLength(1);
  expect(second.nextCursor).toBeNull();
  expect(new Set([...first.data, ...second.data].map((p) => p.slug)).size).toBe(51);
});
