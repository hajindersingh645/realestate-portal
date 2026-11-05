import { NotFoundError } from '@hanu/service-kit';
import { beforeEach, expect, test, vi } from 'vitest';
import { buildTestApp } from '../../test-app.js';
import * as service from './professionals.service.js';

vi.mock('./professionals.service.js');

const CITY = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c01';
const profile: service.PublicProfessional = {
  id: '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c02',
  slug: 'ravi-realty',
  type: 'agent',
  displayName: 'Ravi Realty',
  about: null,
  experienceYears: 8,
  specialisations: ['Plots'],
  licenseNumber: null,
  areas: [{ locationId: CITY, cityId: CITY }],
};

beforeEach(() => {
  vi.resetAllMocks();
});

test('GET /professionals, without a token and with filters, returns 200 and passes them', async () => {
  vi.mocked(service.listProfessionals).mockResolvedValue({ data: [profile], nextCursor: null });
  const { app } = buildTestApp();

  const res = await app.inject({ method: 'GET', url: `/professionals?cityId=${CITY}&type=agent` });

  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ data: [profile], nextCursor: null });
  expect(vi.mocked(service.listProfessionals).mock.calls[0]?.[1]).toEqual({
    cityId: CITY,
    type: 'agent',
  });
});

test('GET /professionals, when the service returns extra fields, never sends them', async () => {
  const leaky = { ...profile, ownerPhone: '+919815012345', status: 'approved' };
  vi.mocked(service.listProfessionals).mockResolvedValue({ data: [leaky], nextCursor: null });
  const { app } = buildTestApp();

  const res = await app.inject({ method: 'GET', url: '/professionals' });

  expect(res.json()).toEqual({ data: [profile], nextCursor: null });
});

test.each(['cityId=mohali', 'type=builder'])('GET /professionals?%s returns 400', async (query) => {
  const { app } = buildTestApp();

  const res = await app.inject({ method: 'GET', url: `/professionals?${query}` });

  expect(res.statusCode).toBe(400);
});

test('GET /professionals/:slug, for an unknown or unapproved slug, returns 404', async () => {
  vi.mocked(service.getProfessional).mockRejectedValue(new NotFoundError());
  const { app } = buildTestApp();

  const res = await app.inject({ method: 'GET', url: '/professionals/ravi-realty' });

  expect(res.statusCode).toBe(404);
});
