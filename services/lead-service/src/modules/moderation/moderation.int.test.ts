import { ConflictError, sql, ValidationError, type Orm } from '@hanu/service-kit';
import { setupServer } from 'msw/node';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createLeadOrm } from '../../orm.js';
import {
  buyer,
  CATALOG,
  catalogHandlers,
  DB_URL,
  IDENTITY,
  identityHandlers,
  requirementInput,
  truncateLead,
} from '../../test/testing.js';
import { createRequirement, submitMyRequirement } from '../requirements/requirements.service.js';
import {
  countRequirementsForStaff,
  decideRequirement,
  expireRequirements,
  getRequirementForStaff,
  listRequirementsForStaff,
  updateBuyerContact,
} from './moderation.service.js';

const deps = { catalogUrl: CATALOG, identityUrl: IDENTITY };
const net = setupServer(...catalogHandlers, ...identityHandlers);
const staff = buyer();
const TZ = 'Asia/Kolkata';
let orm: Orm;

beforeAll(async () => {
  net.listen();
  orm = await createLeadOrm(DB_URL, 'lead');
  await orm.migrator.up();
});

beforeEach(async () => {
  await truncateLead(orm.em.fork());
});

afterAll(async () => {
  net.close();
  await orm.close();
});

/** A requirement waiting for staff, from the buyer's side. */
async function pending(buyerId = crypto.randomUUID(), notes = 'Near a school'): Promise<string> {
  const actor = buyer(buyerId);
  const { id } = await createRequirement(orm.em.fork(), actor, deps, requirementInput({ notes }));
  await submitMyRequirement(orm.em.fork(), actor, deps, id, { consent: true });
  return id;
}

const decide = (id: string, action: 'approve' | 'reject' | 'hide' | 'fake', reason?: string) =>
  decideRequirement(orm.em.fork(), staff, id, action, reason, TZ);

test('approve, for a buyer first requirement, publishes it free with the cap and expiry and queues the event without contact', async () => {
  const id = await pending();

  const view = await decide(id, 'approve');

  expect(view).toMatchObject({ status: 'live', feeType: 'free', maxUnlocks: 5, buyerName: 'Asha' });
  const [row] = await sql<{ days: number }>(
    orm.em.fork(),
    `select round(extract(epoch from expires_at - published_at) / 86400)::int as days from requirements`,
  );
  expect(row?.days).toBe(60);
  const [event] = await sql<{ routing_key: string; envelope: { payload: unknown } }>(
    orm.em.fork(),
    "select routing_key, envelope from outbox_events where routing_key like 'requirement.%'",
  );
  expect(event?.routing_key).toBe('requirement.approved');
  expect(JSON.stringify(event?.envelope)).not.toContain('9815012345');
  expect(event?.envelope.payload).toMatchObject({
    requirementId: id,
    status: 'live',
    reason: null,
  });
});

test('approve, for the same buyer second requirement, waits for payment; a fake first one still uses the quota', async () => {
  const buyerId = crypto.randomUUID();
  const first = await pending(buyerId);
  await decide(first, 'approve');
  await decide(first, 'fake', 'Not a real buyer');
  const second = await pending(buyerId);

  const view = await decide(second, 'approve');

  expect(view).toMatchObject({ status: 'pending_payment', feeType: 'paid', maxUnlocks: null });
});

test('approve, for two requirements of one buyer at the same time, makes exactly one free', async () => {
  const buyerId = crypto.randomUUID();
  const a = await pending(buyerId);
  const b = await pending(buyerId);

  const views = await Promise.all([decide(a, 'approve'), decide(b, 'approve')]);

  expect(views.map((v) => v.status).sort()).toEqual(['live', 'pending_payment']);
});

test('approve, twice at the same time, succeeds once and the other throws ConflictError', async () => {
  const id = await pending();

  const results = await Promise.allSettled([decide(id, 'approve'), decide(id, 'approve')]);

  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  const failed = results.find((r) => r.status === 'rejected');
  expect(failed?.status === 'rejected' && failed.reason).toBeInstanceOf(ConflictError);
});

test('reject, without a reason, throws ValidationError; with one, records it and queues requirement.rejected', async () => {
  const id = await pending();

  await expect(decide(id, 'reject')).rejects.toBeInstanceOf(ValidationError);
  const view = await decide(id, 'reject', 'Budget looks wrong');

  expect(view.status).toBe('rejected');
  expect(view.transitions[0]).toMatchObject({ toStatus: 'rejected', reason: 'Budget looks wrong' });
});

test('hide, for a requirement still pending, throws ConflictError', async () => {
  await expect(decide(await pending(), 'hide', 'Spam')).rejects.toBeInstanceOf(ConflictError);
});

test('list and counts, for staff, leave drafts out and search the note and the buyer name', async () => {
  await pending(undefined, 'Corner plot wanted');
  const live = await pending();
  await decide(live, 'approve');
  await createRequirement(orm.em.fork(), buyer(), deps, requirementInput());

  const all = await listRequirementsForStaff(orm.em.fork(), {});
  const found = await listRequirementsForStaff(orm.em.fork(), { q: 'corner' });
  const counts = await countRequirementsForStaff(orm.em.fork(), undefined);

  expect(all.data).toHaveLength(2);
  expect(found.data).toHaveLength(1);
  expect((await listRequirementsForStaff(orm.em.fork(), { q: 'asha' })).data).toHaveLength(2);
  expect(counts).toMatchObject({ pending_review: 1, live: 1, all: 2 });
  expect(counts).not.toHaveProperty('draft');
  expect((await getRequirementForStaff(orm.em.fork(), live)).buyerPhone).toBe('+919815012345');
});

test('expireRequirements, moves only past-due live requirements, records it, and does nothing on a rerun', async () => {
  const old = await pending();
  const fresh = await pending();
  await decide(old, 'approve');
  await decide(fresh, 'approve');
  await sql(
    orm.em.fork(),
    "update requirements set expires_at = now() - interval '1 minute' where id = ?",
    [old],
  );

  expect(await expireRequirements(orm.em.fork())).toBe(1);
  expect(await expireRequirements(orm.em.fork())).toBe(0);
  expect((await getRequirementForStaff(orm.em.fork(), old)).transitions[0]).toMatchObject({
    fromStatus: 'live',
    toStatus: 'expired',
  });
  expect((await getRequirementForStaff(orm.em.fork(), fresh)).status).toBe('live');
});

test('updateBuyerContact, for a known buyer, updates the copy; for an unknown user, changes nothing', async () => {
  const buyerId = crypto.randomUUID();
  const id = await pending(buyerId);

  await updateBuyerContact(orm.em.fork(), {
    userId: buyerId,
    name: 'Asha K',
    phone: '+919815099999',
  });
  await updateBuyerContact(orm.em.fork(), { userId: crypto.randomUUID(), name: 'X', phone: '+91' });

  expect(await getRequirementForStaff(orm.em.fork(), id)).toMatchObject({
    buyerName: 'Asha K',
    buyerPhone: '+919815099999',
  });
  expect(await sql(orm.em.fork(), 'select 1 from buyer_contacts')).toHaveLength(1);
});
