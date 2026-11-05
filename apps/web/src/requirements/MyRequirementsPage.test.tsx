import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, server } from '@hanu/web-kit/testing';
import { expect, test } from 'vitest';
import { FLAT, REQ_ID, requirement, SECTOR_70, signedIn } from '../test/fixtures';
import { renderApp } from '../test/render';
import { CONSENT_LINE } from './RequirementForm';

const BUYER = ['requirement.create', 'requirement.manage_own'];
const NO_ACCOUNT = () =>
  HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'x' } }, { status: 404 });

function buyerSignedIn(): void {
  signedIn(BUYER, 'buyer');
  server.use(http.get('/api/v1/accounts/me', NO_ACCOUNT));
}

test('the home page, for a buyer, lands on My requirements with status badges and Post a requirement', async () => {
  buyerSignedIn();
  server.use(
    http.get('/api/v1/lead/requirements/mine', () =>
      HttpResponse.json({
        data: [requirement(), requirement({ id: 'r2', status: 'rejected' })],
        nextCursor: null,
      }),
    ),
  );

  renderApp('/');

  expect(await screen.findByRole('heading', { name: 'My requirements' })).toBeInTheDocument();
  expect(await screen.findByText('Live')).toBeInTheDocument();
  expect(screen.getByText('Not approved')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Post a requirement' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'My leads' })).not.toBeInTheDocument();
});

async function fillForm(): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup();
  await user.selectOptions(await screen.findByLabelText('Property type'), FLAT);
  await user.click(screen.getByText('Mohali'));
  await user.click(screen.getByLabelText('Sector 70'));
  await user.type(screen.getByLabelText('Budget from (INR)'), '6000000');
  await user.type(screen.getByLabelText('Budget up to (INR)'), '8500000');
  await user.click(screen.getByLabelText('3'));
  await user.type(screen.getByLabelText('Notes'), 'Near a school');
  await user.click(screen.getByRole('button', { name: 'Review' }));
  return user;
}

test('PostRequirement, reviewed with consent, creates then submits it and opens the detail', async () => {
  buyerSignedIn();
  let created: unknown;
  let submitted: unknown;
  server.use(
    http.post('/api/v1/lead/requirements', async ({ request }) => {
      created = await request.json();
      return HttpResponse.json(requirement({ status: 'draft' }), { status: 201 });
    }),
    http.post(`/api/v1/lead/requirements/mine/${REQ_ID}/submit`, async ({ request }) => {
      submitted = await request.json();
      return HttpResponse.json(requirement({ status: 'pending_review', unlockCount: 0 }));
    }),
    http.get(`/api/v1/lead/requirements/mine/${REQ_ID}`, () =>
      HttpResponse.json(requirement({ status: 'pending_review', unlockCount: 0 })),
    ),
  );
  renderApp('/requirements/new');

  const user = await fillForm();
  expect(await screen.findByText('Check your requirement')).toBeInTheDocument();
  await user.click(screen.getByLabelText(CONSENT_LINE));
  await user.click(screen.getByRole('button', { name: 'Send for review' }));

  expect(await screen.findByText('Waiting for review')).toBeInTheDocument();
  expect(created).toEqual({
    purpose: 'buy',
    propertyTypeId: FLAT,
    locationIds: [SECTOR_70],
    budgetMin: '600000000',
    budgetMax: '850000000',
    bedrooms: [3],
    notes: 'Near a school',
  });
  expect(submitted).toEqual({ consent: true });
});

test('PostRequirement, when the server refuses the notes, shows the reason under the note field', async () => {
  buyerSignedIn();
  server.use(
    http.post('/api/v1/lead/requirements', () =>
      HttpResponse.json(
        { error: { code: 'VALIDATION', message: 'body/notes must not contain a phone number' } },
        { status: 400 },
      ),
    ),
  );
  renderApp('/requirements/new');

  const user = await fillForm();
  await user.click(await screen.findByLabelText(CONSENT_LINE));
  await user.click(screen.getByRole('button', { name: 'Send for review' }));

  expect(await screen.findByText('must not contain a phone number')).toBeInTheDocument();
  expect(screen.getByLabelText('Notes')).toHaveAttribute('aria-invalid', 'true');
});

test('RequirementDetail, when rejected, shows the reason and Edit and resubmit', async () => {
  buyerSignedIn();
  server.use(
    http.get(`/api/v1/lead/requirements/mine/${REQ_ID}`, () =>
      HttpResponse.json(requirement({ status: 'rejected', rejectReason: 'Add a budget range' })),
    ),
  );

  renderApp(`/requirements/${REQ_ID}`);

  expect(await screen.findByText('Add a budget range')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Edit and resubmit' })).toHaveAttribute(
    'href',
    `/requirements/${REQ_ID}/edit`,
  );
});

test('RequirementDetail, when live, lists who unlocked it and closes it after confirming', async () => {
  buyerSignedIn();
  let closed = false;
  server.use(
    http.get(`/api/v1/lead/requirements/mine/${REQ_ID}`, () =>
      HttpResponse.json(requirement({ status: closed ? 'closed' : 'live' })),
    ),
    http.get(`/api/v1/lead/requirements/mine/${REQ_ID}/unlocks`, () =>
      HttpResponse.json({
        data: [
          {
            accountId: 'a1',
            unlockedAt: 'x',
            slug: 's',
            displayName: 'Ravi Realty',
            type: 'agent',
            licenseNumber: null,
          },
        ],
        namesUnavailable: false,
      }),
    ),
    http.post(`/api/v1/lead/requirements/mine/${REQ_ID}/close`, () => {
      closed = true;
      return HttpResponse.json(requirement({ status: 'closed' }));
    }),
  );
  renderApp(`/requirements/${REQ_ID}`);
  const user = userEvent.setup();

  expect(await screen.findByText('Unlocked by 1 of 5')).toBeInTheDocument();
  expect(await screen.findByText('Ravi Realty')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Close' }));
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Close requirement' }),
  );

  expect(await screen.findByText('Closed')).toBeInTheDocument();
  expect(closed).toBe(true);
});

test('RequirementDetail, when approved but waiting for payment, says payment opens soon', async () => {
  buyerSignedIn();
  server.use(
    http.get(`/api/v1/lead/requirements/mine/${REQ_ID}`, () =>
      HttpResponse.json(requirement({ status: 'pending_payment', unlockCount: 0 })),
    ),
  );

  renderApp(`/requirements/${REQ_ID}`);

  expect(await screen.findByText(/Payment opens soon/)).toBeInTheDocument();
});
