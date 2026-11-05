import { useSession } from '@hanu/web-kit';
import { fakeToken, http, HttpResponse, server, TEST_USER } from '@hanu/web-kit/testing';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { renderApp } from '../test/render';
import type { AccountDetail, AccountRow } from './professionals-api';

const ID = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c03';
const row: AccountRow = {
  id: ID,
  type: 'agent',
  displayName: 'Ravi Realty',
  slug: 'ravi-realty',
  status: 'pending',
  createdAt: '2026-11-05T07:00:00.000000Z',
  owner: { userId: 'u2', name: 'Ravi', phone: '+919815020001' },
};
const detail = (overrides: Partial<AccountDetail> = {}): AccountDetail => ({
  ...row,
  about: 'Plots in Mohali',
  experienceYears: 8,
  specialisations: ['Plots'],
  licenseNumber: 'PBRERA-1',
  owner: { ...row.owner, email: null },
  areas: [],
  transitions: [
    {
      fromStatus: null,
      toStatus: 'pending',
      reason: null,
      actorUserId: 'u2',
      actorName: 'Ravi',
      createdAt: '2026-11-05T07:00:00.000000Z',
    },
  ],
  ...overrides,
});

const COUNTS = { pending: 1, approved: 3, rejected: 0, suspended: 0, banned: 0, all: 4 };

function counts(value = COUNTS) {
  server.use(http.get('/api/v1/admin/identity/accounts/counts', () => HttpResponse.json(value)));
}

function signIn(perms = ['admin.account.review']) {
  useSession.getState().signIn({ accessToken: fakeToken(perms), user: TEST_USER });
}

function detailServer(decide: (body: unknown) => Response) {
  const sent: unknown[] = [];
  server.use(
    http.get('/api/v1/catalog/reference', () => HttpResponse.json({ locations: [] })),
    http.get(`/api/v1/admin/identity/accounts/${ID}`, () => HttpResponse.json(detail())),
    http.post(`/api/v1/admin/identity/accounts/${ID}/decision`, async ({ request }) => {
      const body = await request.json();
      sent.push(body);
      return decide(body);
    }),
  );
  return sent;
}

test('ProfessionalsPage, with accounts pending, opens on Pending, shows the counts and lists them', async () => {
  const seen: string[] = [];
  counts();
  server.use(
    http.get('/api/v1/admin/identity/accounts', ({ request }) => {
      seen.push(new URL(request.url).search);
      return HttpResponse.json({ data: [row], nextCursor: null });
    }),
  );
  signIn();

  renderApp('/professionals');

  expect(await screen.findByRole('link', { name: 'Ravi Realty' })).toHaveAttribute(
    'href',
    `/professionals/${ID}`,
  );
  expect(screen.getAllByText('+919815020001').length).toBeGreaterThan(0);
  expect(seen).toEqual(['?status=pending']);
  expect(screen.getByRole('button', { name: 'Pending 1' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Approved 3' })).toBeInTheDocument();
});

test('ProfessionalsPage, with nothing pending, opens on Approved; choosing Pending says nothing is waiting', async () => {
  const seen: string[] = [];
  counts({ ...COUNTS, pending: 0, all: 3 });
  server.use(
    http.get('/api/v1/admin/identity/accounts', ({ request }) => {
      const search = new URL(request.url).search;
      seen.push(search);
      return HttpResponse.json({
        data: search === '?status=approved' ? [{ ...row, status: 'approved' }] : [],
        nextCursor: null,
      });
    }),
  );
  signIn();
  renderApp('/professionals');

  expect(await screen.findByRole('link', { name: 'Ravi Realty' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Approved 3' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await userEvent.setup().click(screen.getByRole('button', { name: 'Pending 0' }));

  expect((await screen.findAllByText('Nothing waiting for review')).length).toBeGreaterThan(0);
  expect(seen).toEqual(['?status=approved', '?status=pending']);
});

test('ProfessionalsPage, on the All tab, asks without a status', async () => {
  const seen: string[] = [];
  counts();
  server.use(
    http.get('/api/v1/admin/identity/accounts', ({ request }) => {
      seen.push(new URL(request.url).search);
      return HttpResponse.json({ data: [], nextCursor: null });
    }),
  );
  signIn();
  renderApp('/professionals');

  await userEvent.setup().click(await screen.findByRole('button', { name: 'All 4' }));

  await screen.findAllByText('No professionals yet');
  expect(seen.at(-1)).toBe('');
});

test('the sidebar, without admin.account.review, hides Professionals', () => {
  signIn(['admin.catalog.manage']);

  renderApp('/');

  const nav = screen.getByRole('navigation', { name: 'Main' });
  expect(within(nav).queryByRole('link', { name: 'Professionals' })).not.toBeInTheDocument();
});

test('ProfessionalDetailPage, approve, sends approve without a reason', async () => {
  const sent = detailServer(() => HttpResponse.json(detail({ status: 'approved' })));
  signIn();
  renderApp(`/professionals/${ID}`);
  const user = userEvent.setup();

  await user.click(await screen.findByRole('button', { name: 'Approve' }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve' }));

  await screen.findByText('Ravi Realty is now approved');
  expect(sent).toEqual([{ action: 'approve' }]);
});

test('ProfessionalDetailPage, reject without a reason, is blocked', async () => {
  const sent = detailServer(() => HttpResponse.json(detail({ status: 'rejected' })));
  signIn();
  renderApp(`/professionals/${ID}`);
  const user = userEvent.setup();

  await user.click(await screen.findByRole('button', { name: 'Reject' }));
  const dialog = screen.getByRole('dialog');

  expect(within(dialog).getByRole('button', { name: 'Reject' })).toBeDisabled();
  await user.type(within(dialog).getByRole('textbox'), 'Add your RERA number');
  await user.click(within(dialog).getByRole('button', { name: 'Reject' }));
  await screen.findByText('Ravi Realty is now rejected');
  expect(sent).toEqual([{ action: 'reject', reason: 'Add your RERA number' }]);
});

test('ProfessionalDetailPage, when someone else decided first (409), says so', async () => {
  detailServer(() =>
    HttpResponse.json(
      { error: { code: 'CONFLICT', message: 'A approved account cannot be given "approve"' } },
      { status: 409 },
    ),
  );
  signIn();
  renderApp(`/professionals/${ID}`);
  const user = userEvent.setup();

  await user.click(await screen.findByRole('button', { name: 'Approve' }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve' }));

  expect(
    await screen.findByText('Someone already decided this account. Reload to see it.'),
  ).toBeInTheDocument();
});

test('ProfessionalDetailPage, shows the owner, profile and history', async () => {
  detailServer(() => HttpResponse.json(detail()));
  signIn();

  renderApp(`/professionals/${ID}`);

  expect(await screen.findByRole('heading', { name: 'Ravi Realty' })).toBeInTheDocument();
  expect(screen.getByText('PBRERA-1')).toBeInTheDocument();
  expect(screen.getByText('Plots in Mohali')).toBeInTheDocument();
  const history = screen.getByRole('list', { name: 'History' });
  expect(within(history).getByText(/Created/)).toBeInTheDocument();
});

test('ProfessionalDetailPage, for a banned account, offers no actions', async () => {
  server.use(
    http.get('/api/v1/catalog/reference', () => HttpResponse.json({ locations: [] })),
    http.get(`/api/v1/admin/identity/accounts/${ID}`, () =>
      HttpResponse.json(detail({ status: 'banned' })),
    ),
  );
  signIn();

  renderApp(`/professionals/${ID}`);

  await screen.findByRole('heading', { name: 'Ravi Realty' });
  expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Ban' })).not.toBeInTheDocument();
});
