import { ForbiddenError, NotFoundError, sql, type Orm } from '@hanu/service-kit';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'vitest';
import { createLeadOrm } from '../../orm.js';
import {
  buyer,
  CATALOG,
  catalogHandlers,
  CITY,
  DB_URL,
  IDENTITY,
  identityHandlers,
  requirementInput,
  truncateLead,
} from '../../test/testing.js';
import { decideRequirement } from '../moderation/moderation.service.js';
import { createRequirement, submitMyRequirement } from '../requirements/requirements.service.js';
import {
  getPublicRequirement,
  listMyLeads,
  listPublicRequirements,
  listUnlocksForBuyer,
  unlockRequirement,
  type LeadCaller,
} from './leads.service.js';

const deps = { catalogUrl: CATALOG, identityUrl: IDENTITY };
const net = setupServer(...catalogHandlers, ...identityHandlers);
let orm: Orm;

beforeAll(async () => {
  net.listen();
  orm = await createLeadOrm(DB_URL, 'lead');
  await orm.migrator.up();
});

beforeEach(async () => {
  await truncateLead(orm.em.fork());
  await sql(orm.em.fork(), "delete from settings where key = 'lead.unlock.free' and version > 1");
});

afterEach(() => {
  net.resetHandlers();
});

afterAll(async () => {
  net.close();
  await orm.close();
});

async function live(buyerId = randomUUID()): Promise<string> {
  const actor = buyer(buyerId);
  const { id } = await createRequirement(orm.em.fork(), actor, deps, requirementInput());
  await submitMyRequirement(orm.em.fork(), actor, deps, id, { consent: true });
  await decideRequirement(orm.em.fork(), buyer(), id, 'approve', undefined, 'Asia/Kolkata');
  return id;
}

const pro = (accountId = randomUUID(), accountStatus = 'approved'): LeadCaller => ({
  userId: randomUUID(),
  accountId,
  accountStatus,
});
const unlock = (caller: LeadCaller, id: string) =>
  unlockRequirement(orm.em.fork(), caller, buyer(caller.userId), id);

test('unlock, when 6 accounts click at once, lets 5 in and answers the 6th with LEAD_FULL', async () => {
  const id = await live();

  const results = await Promise.allSettled(Array.from({ length: 6 }, () => unlock(pro(), id)));

  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(5);
  const [failed] = results.filter((r) => r.status === 'rejected');
  expect(failed?.status === 'rejected' && failed.reason).toMatchObject({ code: 'LEAD_FULL' });
  const [row] = await sql<{ n: number; c: number }>(
    orm.em.fork(),
    'select (select count(*)::int from lead_unlocks) as n, unlock_count as c from requirements',
  );
  expect(row).toEqual({ n: 5, c: 5 });
});

test('unlock, on a double click by one account, keeps one unlock and counts it once', async () => {
  const id = await live();
  const caller = pro();

  const [a, b] = [await unlock(caller, id), await unlock(caller, id)];

  expect(a.unlockId).toBe(b.unlockId);
  expect(a.buyer).toEqual({ name: 'Asha', phone: '+919815012345' });
  const [row] = await sql<{ c: number }>(
    orm.em.fork(),
    'select unlock_count as c from requirements',
  );
  expect(row?.c).toBe(1);
  const audits = await sql(
    orm.em.fork(),
    "select 1 from outbox_events where envelope::text like '%lead.unlocked%'",
  );
  expect(audits).toHaveLength(1);
});

test('unlock, for a pending account or a caller without one, returns 403', async () => {
  const id = await live();

  await expect(unlock(pro(randomUUID(), 'pending'), id)).rejects.toBeInstanceOf(ForbiddenError);
  await expect(unlock({ userId: randomUUID() }, id)).rejects.toBeInstanceOf(ForbiddenError);
});

test('unlock and public view, for an expired or hidden requirement, return 404', async () => {
  const expired = await live();
  const hidden = await live();
  await sql(
    orm.em.fork(),
    "update requirements set expires_at = now() - interval '1 minute' where id = ?",
    [expired],
  );
  await decideRequirement(orm.em.fork(), buyer(), hidden, 'hide', 'Spam', 'Asia/Kolkata');

  for (const id of [expired, hidden]) {
    await expect(unlock(pro(), id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getPublicRequirement(orm.em.fork(), id)).rejects.toBeInstanceOf(NotFoundError);
  }
  expect((await listPublicRequirements(orm.em.fork(), {})).data).toEqual([]);
});

test('unlock, when lead.unlock.free is turned off, returns UNLOCKS_UNAVAILABLE', async () => {
  const id = await live();
  await sql(
    orm.em.fork(),
    `insert into settings (key, version, value, changed_by, changed_at)
     select key, version + 1, 'false', null, now() from settings
      where key = 'lead.unlock.free' order by version desc limit 1`,
  );

  const err = await unlock(pro(), id).catch((e: unknown) => e);

  expect(err).toMatchObject({ code: 'UNLOCKS_UNAVAILABLE', httpStatus: 409 });
});

test('my leads, for the unlocking account only, shows the buyer contact', async () => {
  const id = await live();
  const mine = pro();
  await unlock(mine, id);

  const own = await listMyLeads(orm.em.fork(), mine, undefined);
  const other = await listMyLeads(orm.em.fork(), pro(), undefined);

  expect(own.data.map((l) => [l.id, l.buyer.phone])).toEqual([[id, '+919815012345']]);
  expect(other.data).toEqual([]);
});

test('public list, for a buyer whose name carries a phone number, shows "Buyer" and filters by city', async () => {
  net.use(
    http.get(`${IDENTITY}/internal/users/:id`, ({ params }) =>
      HttpResponse.json({
        id: params.id,
        name: 'Asha 9815012345',
        phone: '+919815012345',
        registeredAs: 'buyer',
        status: 'active',
      }),
    ),
  );
  const id = await live();

  const page = await listPublicRequirements(orm.em.fork(), { cityId: CITY });
  const none = await listPublicRequirements(orm.em.fork(), { cityId: randomUUID() });

  expect(page.data.map((r) => [r.id, r.buyerName])).toEqual([[id, 'Buyer']]);
  expect(none.data).toEqual([]);
});

test('unlocked by, for the owner, lists accounts with names, and without them when identity is down', async () => {
  const buyerId = randomUUID();
  const id = await live(buyerId);
  const account = randomUUID();
  await unlock(pro(account), id);
  net.use(
    http.get(`${IDENTITY}/internal/accounts`, () =>
      HttpResponse.json({
        data: [
          {
            id: account,
            slug: 'sharma',
            displayName: 'Sharma Realty',
            type: 'agency',
            licenseNumber: null,
          },
        ],
      }),
    ),
  );

  const named = await listUnlocksForBuyer(orm.em.fork(), buyerId, id, IDENTITY);
  net.use(http.get(`${IDENTITY}/internal/accounts`, () => HttpResponse.error()));
  const bare = await listUnlocksForBuyer(orm.em.fork(), buyerId, id, IDENTITY);

  expect(named).toMatchObject({
    namesUnavailable: false,
    data: [{ accountId: account, displayName: 'Sharma Realty' }],
  });
  expect(bare).toMatchObject({
    namesUnavailable: true,
    data: [{ accountId: account, displayName: null }],
  });
  await expect(
    listUnlocksForBuyer(orm.em.fork(), randomUUID(), id, IDENTITY),
  ).rejects.toBeInstanceOf(NotFoundError);
});
