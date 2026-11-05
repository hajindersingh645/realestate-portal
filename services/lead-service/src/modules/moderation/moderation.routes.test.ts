import { beforeEach, expect, test, vi } from 'vitest';
import { testApp } from '../../test/app.js';
import * as service from './moderation.service.js';

vi.mock('./moderation.service.js');

const ID = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c01';

beforeEach(() => {
  vi.resetAllMocks();
});

test('GET /lead/admin/requirements/counts, for staff, returns the counts without calling the detail route', async () => {
  const counts = {
    pending_review: 1,
    rejected: 0,
    pending_payment: 0,
    live: 2,
    expired: 0,
    closed: 0,
    hidden: 0,
    fake: 0,
    all: 3,
  };
  vi.mocked(service.countRequirementsForStaff).mockResolvedValue(counts);
  const { app, headers } = await testApp(['admin.lead.moderate']);

  const res = await app.inject({
    method: 'GET',
    url: '/lead/admin/requirements/counts?q=asha',
    headers,
  });

  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual(counts);
  expect(vi.mocked(service.countRequirementsForStaff).mock.calls[0]?.[1]).toBe('asha');
  expect(vi.mocked(service.getRequirementForStaff)).not.toHaveBeenCalled();
});

test('POST /lead/admin/requirements/:id/decision, without admin.lead.moderate, returns 403', async () => {
  const { app, headers } = await testApp(['requirement.manage_own']);

  const res = await app.inject({
    method: 'POST',
    url: `/lead/admin/requirements/${ID}/decision`,
    headers,
    payload: { action: 'approve' },
  });

  expect(res.statusCode).toBe(403);
  expect(vi.mocked(service.decideRequirement)).not.toHaveBeenCalled();
});

test('POST /lead/admin/requirements/:id/decision, with an unknown action, returns 400', async () => {
  const { app, headers } = await testApp(['admin.lead.moderate']);

  const res = await app.inject({
    method: 'POST',
    url: `/lead/admin/requirements/${ID}/decision`,
    headers,
    payload: { action: 'delete' },
  });

  expect(res.statusCode).toBe(400);
});
