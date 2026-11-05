import { beforeEach, expect, test, vi } from 'vitest';
import { buildTestApp } from '../../test-app.js';
import * as service from './accounts.service.js';

vi.mock('./accounts.service.js');

const A = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c01';
const B = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c02';

beforeEach(() => {
  vi.resetAllMocks();
});

test('GET /internal/accounts, with two ids, passes both and returns what the lookup found', async () => {
  const row = {
    id: A,
    slug: 'ravi-realty',
    displayName: 'Ravi Realty',
    type: 'agent' as const,
    licenseNumber: null,
    status: 'approved' as const,
  };
  vi.mocked(service.lookupAccounts).mockResolvedValue([row]);
  const { app } = buildTestApp();

  const res = await app.inject({ method: 'GET', url: `/internal/accounts?ids=${A},${B}` });

  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ data: [row] });
  expect(vi.mocked(service.lookupAccounts).mock.calls[0]?.[1]).toEqual([A, B]);
});

test('GET /internal/accounts, with an id that is not a UUID, returns 400', async () => {
  const { app } = buildTestApp();

  const res = await app.inject({ method: 'GET', url: `/internal/accounts?ids=${A},nope` });

  expect(res.statusCode).toBe(400);
  expect(vi.mocked(service.lookupAccounts)).not.toHaveBeenCalled();
});
