import { ConflictError } from '@hanu/service-kit';
import { beforeEach, expect, test, vi } from 'vitest';
import { requirementInput } from '../../test/testing.js';
import { testApp } from '../../test/app.js';
import * as service from './requirements.service.js';
import type { MyRequirement } from './requirements.schemas.js';

vi.mock('./requirements.service.js');

const ID = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c01';
const view: MyRequirement = {
  id: ID,
  status: 'draft',
  purpose: 'buy',
  propertyTypeId: ID,
  areas: [{ locationId: ID, cityId: ID }],
  budgetMin: '6000000000',
  budgetMax: '8500000000',
  bedrooms: [3],
  areaMin: null,
  areaMax: null,
  areaUnit: null,
  possession: null,
  timeline: null,
  loanNeeded: null,
  preferences: {},
  notes: null,
  unlockCount: 0,
  maxUnlocks: null,
  feeType: null,
  submittedAt: null,
  publishedAt: null,
  expiresAt: null,
  closedAt: null,
  createdAt: '2026-11-05T10:00:00.000000Z',
  rejectReason: null,
};

beforeEach(() => {
  vi.resetAllMocks();
});

test('POST /lead/requirements, for a buyer, returns 201 with the draft and passes the body', async () => {
  vi.mocked(service.createRequirement).mockResolvedValue(view);
  const { app, headers } = await testApp(['requirement.create']);

  const res = await app.inject({
    method: 'POST',
    url: '/lead/requirements',
    headers,
    payload: requirementInput(),
  });

  expect(res.statusCode).toBe(201);
  expect(res.json()).toEqual(view);
  expect(vi.mocked(service.createRequirement).mock.calls[0]?.[3]).toEqual(requirementInput());
});

test('POST /lead/requirements, for a professional (no requirement.create), returns 403', async () => {
  const { app, headers } = await testApp(['lead.unlock']);

  const res = await app.inject({
    method: 'POST',
    url: '/lead/requirements',
    headers,
    payload: requirementInput(),
  });

  expect(res.statusCode).toBe(403);
  expect(vi.mocked(service.createRequirement)).not.toHaveBeenCalled();
});

test('POST /lead/requirements, with an unknown purpose or a decimal budget, returns 400', async () => {
  const { app, headers } = await testApp(['requirement.create']);

  const purpose = await app.inject({
    method: 'POST',
    url: '/lead/requirements',
    headers,
    payload: { ...requirementInput(), purpose: 'lease' },
  });
  const budget = await app.inject({
    method: 'POST',
    url: '/lead/requirements',
    headers,
    payload: { ...requirementInput(), budgetMin: '60.5' },
  });

  expect(purpose.statusCode).toBe(400);
  expect(budget.statusCode).toBe(400);
});

test('POST /lead/requirements/mine/:id/submit, when the service refuses, returns 409 with its message', async () => {
  vi.mocked(service.submitMyRequirement).mockRejectedValue(
    new ConflictError('A requirement in pending_review cannot be sent for review'),
  );
  const { app, headers } = await testApp(['requirement.manage_own']);

  const res = await app.inject({
    method: 'POST',
    url: `/lead/requirements/mine/${ID}/submit`,
    headers,
    payload: { consent: true },
  });

  expect(res.statusCode).toBe(409);
  expect(res.json()).toMatchObject({
    error: { message: 'A requirement in pending_review cannot be sent for review' },
  });
});

test('GET /lead/requirements/mine, without a token, returns 401', async () => {
  const { app } = await testApp();

  const res = await app.inject({ method: 'GET', url: '/lead/requirements/mine' });

  expect(res.statusCode).toBe(401);
});

test('GET /lead/requirements/mine, for a buyer, passes the cursor and returns the page', async () => {
  vi.mocked(service.listMyRequirements).mockResolvedValue({ data: [view], nextCursor: null });
  const { app, headers } = await testApp(['requirement.manage_own']);

  const res = await app.inject({
    method: 'GET',
    url: '/lead/requirements/mine?cursor=abc',
    headers,
  });

  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ data: [view], nextCursor: null });
  expect(vi.mocked(service.listMyRequirements).mock.calls[0]?.[2]).toBe('abc');
});
