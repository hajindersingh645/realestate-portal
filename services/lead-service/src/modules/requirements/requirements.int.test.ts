import {
  ConflictError,
  NotFoundError,
  sql,
  UpstreamError,
  ValidationError,
  type Orm,
} from '@hanu/service-kit';
import { http, HttpResponse } from 'msw/http';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'vitest';
import { createLeadOrm } from '../../orm.js';
import {
  buyer,
  CATALOG,
  catalogHandlers,
  CITY,
  DB_URL,
  LOCALITY,
  requirementInput,
  RETIRED_TYPE,
  STATE,
  truncateLead,
} from '../../test/testing.js';
import {
  closeMyRequirement,
  createRequirement,
  getMyRequirement,
  listMyRequirements,
  submitMyRequirement,
  updateMyRequirement,
} from './requirements.service.js';

const deps = { catalogUrl: CATALOG };
const catalog = setupServer(...catalogHandlers);
let orm: Orm;

beforeAll(async () => {
  catalog.listen();
  orm = await createLeadOrm(DB_URL, 'lead');
  await orm.migrator.up();
});

beforeEach(async () => {
  await truncateLead(orm.em.fork());
});

afterEach(() => {
  catalog.resetHandlers();
});

afterAll(async () => {
  catalog.close();
  await orm.close();
});

async function setStatus(id: string, status: string): Promise<void> {
  await sql(orm.em.fork(), 'update requirements set status = ? where id = ?', [status, id]);
}

test('createRequirement, for a buyer, saves a draft with its areas and the city copied', async () => {
  const asha = buyer();

  const created = await createRequirement(orm.em.fork(), asha, deps, requirementInput());

  expect(created).toMatchObject({
    status: 'draft',
    purpose: 'buy',
    budgetMin: '6000000000',
    budgetMax: '8500000000',
    bedrooms: [3],
    areaMin: '1500',
    preferences: { facing: 'east', lift: true },
    unlockCount: 0,
    rejectReason: null,
  });
  expect(created.areas).toEqual(
    expect.arrayContaining([
      { locationId: CITY, cityId: CITY },
      { locationId: LOCALITY, cityId: CITY },
    ]),
  );
});

test('createRequirement, with a state, a retired property type, or a minimum above the maximum, throws ValidationError', async () => {
  const asha = buyer();
  const em = orm.em.fork();

  await expect(
    createRequirement(em, asha, deps, requirementInput({ locationIds: [STATE] })),
  ).rejects.toBeInstanceOf(ValidationError);
  await expect(
    createRequirement(em, asha, deps, requirementInput({ propertyTypeId: RETIRED_TYPE })),
  ).rejects.toBeInstanceOf(ValidationError);
  await expect(
    createRequirement(em, asha, deps, requirementInput({ budgetMin: '9', budgetMax: '1' })),
  ).rejects.toBeInstanceOf(ValidationError);
  expect(await sql(em, 'select id from requirements')).toHaveLength(0);
});

test('createRequirement, when catalog is down, throws UpstreamError and saves nothing', async () => {
  catalog.use(http.get(`${CATALOG}/internal/locations`, () => HttpResponse.error()));

  await expect(
    createRequirement(orm.em.fork(), buyer(), deps, requirementInput()),
  ).rejects.toBeInstanceOf(UpstreamError);
  expect(await sql(orm.em.fork(), 'select id from requirements')).toHaveLength(0);
});

test('submitMyRequirement, with consent, moves the draft to pending_review and records it', async () => {
  const asha = buyer();
  const { id } = await createRequirement(orm.em.fork(), asha, deps, requirementInput());

  const submitted = await submitMyRequirement(orm.em.fork(), asha, id, { consent: true });

  expect(submitted.status).toBe('pending_review');
  expect(submitted.submittedAt).not.toBeNull();
  const history = await sql<{ from_state: string; to_state: string; actor_user_id: string }>(
    orm.em.fork(),
    `select from_state, to_state, actor_user_id from state_transitions
      where entity_type = 'requirement' and entity_id = ? order by created_at, id`,
    [id],
  );
  expect(history).toEqual([
    { from_state: null, to_state: 'draft', actor_user_id: asha.userId },
    { from_state: 'draft', to_state: 'pending_review', actor_user_id: asha.userId },
  ]);
});

test('submitMyRequirement, without consent, throws ValidationError and stays a draft', async () => {
  const asha = buyer();
  const { id } = await createRequirement(orm.em.fork(), asha, deps, requirementInput());

  await expect(
    submitMyRequirement(orm.em.fork(), asha, id, { consent: false }),
  ).rejects.toBeInstanceOf(ValidationError);
  expect((await getMyRequirement(orm.em.fork(), asha, id)).status).toBe('draft');
});

test('submitMyRequirement, with a phone in the notes or an email in a preference, throws ValidationError naming the field', async () => {
  const asha = buyer();
  const withPhone = await createRequirement(
    orm.em.fork(),
    asha,
    deps,
    requirementInput({ notes: '<p>call <b>98150</b> 12345</p>' }),
  );
  const withEmail = await createRequirement(
    orm.em.fork(),
    asha,
    deps,
    requirementInput({ preferences: { other: 'write to a@b.in' } }),
  );

  await expect(
    submitMyRequirement(orm.em.fork(), asha, withPhone.id, { consent: true }),
  ).rejects.toThrow('body/notes Remove phone numbers, emails and links');
  await expect(
    submitMyRequirement(orm.em.fork(), asha, withEmail.id, { consent: true }),
  ).rejects.toThrow('body/preferences Remove phone numbers, emails and links');
});

test('updateMyRequirement, while pending_review, throws ConflictError; while rejected, saves the change', async () => {
  const asha = buyer();
  const { id } = await createRequirement(orm.em.fork(), asha, deps, requirementInput());
  await submitMyRequirement(orm.em.fork(), asha, id, { consent: true });

  await expect(
    updateMyRequirement(orm.em.fork(), asha, deps, id, { notes: 'Changed' }),
  ).rejects.toBeInstanceOf(ConflictError);

  await setStatus(id, 'rejected');
  const updated = await updateMyRequirement(orm.em.fork(), asha, deps, id, {
    notes: 'Changed',
    locationIds: [LOCALITY],
  });
  expect(updated).toMatchObject({
    notes: 'Changed',
    areas: [{ locationId: LOCALITY, cityId: CITY }],
  });
});

test('another buyer, reading, editing, submitting or closing a requirement, gets NotFoundError', async () => {
  const asha = buyer();
  const ravi = buyer();
  const { id } = await createRequirement(orm.em.fork(), asha, deps, requirementInput());
  const em = orm.em.fork();

  await expect(getMyRequirement(em, ravi, id)).rejects.toBeInstanceOf(NotFoundError);
  await expect(updateMyRequirement(em, ravi, deps, id, { notes: 'x' })).rejects.toBeInstanceOf(
    NotFoundError,
  );
  await expect(submitMyRequirement(em, ravi, id, { consent: true })).rejects.toBeInstanceOf(
    NotFoundError,
  );
  await expect(closeMyRequirement(em, ravi, id)).rejects.toBeInstanceOf(NotFoundError);
});

test('closeMyRequirement, for a draft, throws ConflictError; for a live one, closes it and records it', async () => {
  const asha = buyer();
  const { id } = await createRequirement(orm.em.fork(), asha, deps, requirementInput());

  await expect(closeMyRequirement(orm.em.fork(), asha, id)).rejects.toBeInstanceOf(ConflictError);

  await sql(
    orm.em.fork(),
    `update requirements set status = 'live', published_at = now(), max_unlocks = 5,
                             expires_at = now() + interval '60 days' where id = ?`,
    [id],
  );
  const closed = await closeMyRequirement(orm.em.fork(), asha, id);
  expect(closed.status).toBe('closed');
  expect(closed.closedAt).not.toBeNull();
});

test('getMyRequirement, after a rejection, shows the latest reason', async () => {
  const asha = buyer();
  const { id } = await createRequirement(orm.em.fork(), asha, deps, requirementInput());
  await setStatus(id, 'rejected');
  await sql(
    orm.em.fork(),
    `insert into state_transitions (id, entity_type, entity_id, from_state, to_state, reason, created_at)
     values (gen_random_uuid(), 'requirement', ?, 'pending_review', 'rejected', 'Budget looks wrong', now())`,
    [id],
  );

  expect((await getMyRequirement(orm.em.fork(), asha, id)).rejectReason).toBe('Budget looks wrong');
});

test('listMyRequirements, with 51 requirements, pages 50 then 1, newest first, only the buyer own', async () => {
  const asha = buyer();
  await createRequirement(orm.em.fork(), buyer(), deps, requirementInput());
  for (let i = 0; i < 51; i += 1) {
    await createRequirement(
      orm.em.fork(),
      asha,
      deps,
      requirementInput({ notes: `n${String(i)}` }),
    );
  }

  const first = await listMyRequirements(orm.em.fork(), asha, undefined);
  const second = await listMyRequirements(orm.em.fork(), asha, first.nextCursor ?? undefined);

  expect(first.data).toHaveLength(50);
  expect(first.data[0]?.notes).toBe('n50');
  expect(second.data.map((r) => r.notes)).toEqual(['n0']);
  expect(second.nextCursor).toBeNull();
});
