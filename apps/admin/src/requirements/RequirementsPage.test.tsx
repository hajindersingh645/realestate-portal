import { useSession } from '@hanu/web-kit';
import { fakeToken, http, HttpResponse, server, TEST_USER } from '@hanu/web-kit/testing';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { renderApp } from '../test/render';
import type { RequirementCounts, RequirementDetail, RequirementRow } from './requirements-api';

const ID = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c05';
const CITY = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c01';
const FLAT = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c04';
const row: RequirementRow = {
  id: ID,
  status: 'pending_review',
  purpose: 'buy',
  propertyTypeId: FLAT,
  cityIds: [CITY],
  budgetMin: '6000000000',
  budgetMax: '8500000000',
  buyerName: 'Asha',
  submittedAt: '2026-11-05T07:00:00.000Z',
  createdAt: '2026-11-05T06:00:00.000Z',
};
const detail = (overrides: Partial<RequirementDetail> = {}): RequirementDetail => ({
  ...row,
  buyerPhone: '+919815012345',
  areas: [{ locationId: CITY, cityId: CITY }],
  bedrooms: [3],
  areaMin: null,
  areaMax: null,
  areaUnit: null,
  possession: null,
  timeline: null,
  loanNeeded: null,
  notes: 'Near a school',
  unlockCount: 0,
  maxUnlocks: null,
  feeType: null,
  publishedAt: null,
  expiresAt: null,
  transitions: [
    {
      fromStatus: 'draft',
      toStatus: 'pending_review',
      reason: null,
      actorUserId: 'u2',
      createdAt: '2026-11-05T07:00:00.000Z',
    },
  ],
  ...overrides,
});
const COUNTS: RequirementCounts = {
  draft: 0,
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
const REFERENCE = {
  platform: { currency: 'INR', locale: 'en-IN' },
  locations: [{ id: CITY, name: 'Mohali' }],
  propertyTypes: [{ id: FLAT, name: 'Flat' }],
};

function setup(counts = COUNTS, rows: RequirementRow[] = [row]): string[] {
  useSession
    .getState()
    .signIn({ accessToken: fakeToken(['admin.lead.moderate']), user: TEST_USER });
  const seen: string[] = [];
  server.use(
    http.get('/api/v1/catalog/reference', () => HttpResponse.json(REFERENCE)),
    http.get('/api/v1/lead/admin/requirements/counts', () => HttpResponse.json(counts)),
    http.get('/api/v1/lead/admin/requirements', ({ request }) => {
      seen.push(new URL(request.url).search);
      return HttpResponse.json({ data: rows, nextCursor: null });
    }),
  );
  return seen;
}

test('RequirementsPage, with requirements pending, opens on Pending with counts and lists them once', async () => {
  const seen = setup();

  renderApp('/requirements');

  expect(await screen.findByText('Buy Flat · Mohali')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^Pending/ })).toHaveTextContent('1');
  expect(seen).toEqual(['?status=pending_review']);
});

test('RequirementsPage, with nothing pending, opens on Live and says so when empty', async () => {
  const seen = setup({ ...COUNTS, pending_review: 0 }, []);

  renderApp('/requirements');

  expect(await screen.findByText('No live requirements')).toBeInTheDocument();
  expect(seen).toEqual(['?status=live']);
});

test('RequirementDetail, for a pending requirement, shows the buyer contact and approves it', async () => {
  setup();
  const sent: unknown[] = [];
  server.use(
    http.get(`/api/v1/lead/admin/requirements/${ID}`, () => HttpResponse.json(detail())),
    http.post(`/api/v1/lead/admin/requirements/${ID}/decision`, async ({ request }) => {
      sent.push(await request.json());
      return HttpResponse.json(detail({ status: 'live' }));
    }),
  );
  renderApp(`/requirements/${ID}`);
  const user = userEvent.setup();

  expect(await screen.findByText('Asha · +919815012345')).toBeInTheDocument();
  expect(screen.getByText('Near a school')).toBeInTheDocument();
  expect(screen.getByText('₹6,00,00,000 – ₹8,50,00,000')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Approve' }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve' }));

  expect(sent).toEqual([{ action: 'approve' }]);
});

test('RequirementDetail, rejecting, needs a reason and shows a 409 message', async () => {
  setup();
  const sent: unknown[] = [];
  server.use(
    http.get(`/api/v1/lead/admin/requirements/${ID}`, () => HttpResponse.json(detail())),
    http.post(`/api/v1/lead/admin/requirements/${ID}/decision`, async ({ request }) => {
      sent.push(await request.json());
      return HttpResponse.json(
        { error: { code: 'CONFLICT', message: 'Already decided' } },
        { status: 409 },
      );
    }),
  );
  renderApp(`/requirements/${ID}`);
  const user = userEvent.setup();

  await user.click(await screen.findByRole('button', { name: 'Reject' }));
  const dialog = screen.getByRole('dialog');
  await user.click(within(dialog).getByRole('button', { name: 'Reject' }));
  expect(sent).toEqual([]);
  await user.type(within(dialog).getByRole('textbox'), 'Remove the phone number');
  await user.click(within(dialog).getByRole('button', { name: 'Reject' }));

  expect(await within(dialog).findByText(/Someone already decided/)).toBeInTheDocument();
  expect(sent).toEqual([{ action: 'reject', reason: 'Remove the phone number' }]);
});
