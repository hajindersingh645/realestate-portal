import { beforeEach, expect, test, vi } from 'vitest';
import { testApp } from '../../test/app.js';
import * as service from './leads.service.js';

vi.mock('./leads.service.js');

const ID = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c01';
const row = {
  id: ID,
  buyerName: 'Asha',
  buyerId: 'leak',
  phone: '+919815012345',
  email: 'a@b.c',
  purpose: 'buy',
  propertyTypeId: ID,
  areas: [],
  budgetMin: '1',
  budgetMax: '2',
  bedrooms: [3],
  areaMin: null,
  areaMax: null,
  areaUnit: null,
  possession: null,
  timeline: null,
  loanNeeded: null,
  preferences: {},
  notes: null,
  publishedAt: 'x',
  expiresAt: 'y',
  unlockCount: 0,
  maxUnlocks: 5,
};

beforeEach(() => {
  vi.resetAllMocks();
});

test('GET /lead/requirements, without a token, returns the buyer name and never an id, phone or email', async () => {
  vi.mocked(service.listPublicRequirements).mockResolvedValue({ data: [row], nextCursor: null });
  const { app } = await testApp();

  const res = await app.inject({
    method: 'GET',
    url: `/lead/requirements?cityId=${ID}&purpose=buy`,
  });

  expect(res.statusCode).toBe(200);
  const [item] = res.json<{ data: Record<string, unknown>[] }>().data;
  expect(item?.buyerName).toBe('Asha');
  expect(item).not.toHaveProperty('buyerId');
  expect(item).not.toHaveProperty('phone');
  expect(item).not.toHaveProperty('email');
  expect(vi.mocked(service.listPublicRequirements).mock.calls[0]?.[1]).toMatchObject({
    cityId: ID,
    purpose: 'buy',
  });
});

test('GET /lead/requirements, with an unknown purpose, returns 400', async () => {
  const { app } = await testApp();

  const res = await app.inject({ method: 'GET', url: '/lead/requirements?purpose=steal' });

  expect(res.statusCode).toBe(400);
});

test('POST /lead/requirements/:id/unlock, without lead.unlock, returns 403', async () => {
  const { app, headers } = await testApp([]);

  const res = await app.inject({ method: 'POST', url: `/lead/requirements/${ID}/unlock`, headers });

  expect(res.statusCode).toBe(403);
  expect(vi.mocked(service.unlockRequirement)).not.toHaveBeenCalled();
});

test('POST /lead/requirements/:id/unlock, for a professional, passes the account claims through', async () => {
  vi.mocked(service.unlockRequirement).mockResolvedValue({
    ...row,
    unlockId: ID,
    unlockedAt: 'z',
    buyer: { name: 'Asha', phone: '+919815012345' },
  });
  const { app, headers } = await testApp(['lead.unlock'], { acc: ID, accSt: 'approved' });

  const res = await app.inject({ method: 'POST', url: `/lead/requirements/${ID}/unlock`, headers });

  expect(res.statusCode).toBe(200);
  expect(vi.mocked(service.unlockRequirement).mock.calls[0]?.[1]).toMatchObject({
    accountId: ID,
    accountStatus: 'approved',
  });
});
