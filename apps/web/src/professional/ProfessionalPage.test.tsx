import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, server } from '@hanu/web-kit/testing';
import { expect, test } from 'vitest';
import { account, NO_ACCOUNT, SECTOR_70, signedIn } from '../test/fixtures';
import { renderApp } from '../test/render';

test('the home page, for a professional without an account, lands on Create your professional profile', async () => {
  signedIn([], 'professional');
  server.use(http.get('/api/v1/accounts/me', NO_ACCOUNT));

  renderApp('/');

  expect(
    await screen.findByRole('heading', { name: 'Create your professional profile' }),
  ).toBeInTheDocument();
});

test('the home page, for a buyer, lands on My profile', async () => {
  signedIn([], 'buyer');
  server.use(http.get('/api/v1/accounts/me', NO_ACCOUNT));

  renderApp('/');

  expect(await screen.findByRole('heading', { name: 'My profile' })).toBeInTheDocument();
});

test('CreateProfile, filled in with a city and a locality, sends the profile', async () => {
  signedIn([], 'professional');
  let sent: unknown;
  server.use(
    http.get('/api/v1/accounts/me', () =>
      sent === undefined ? NO_ACCOUNT() : HttpResponse.json(account()),
    ),
    http.post('/api/v1/accounts/me', async ({ request }) => {
      sent = await request.json();
      return HttpResponse.json(account(), { status: 201 });
    }),
  );
  renderApp('/professional');
  const user = userEvent.setup();

  await user.click(await screen.findByLabelText('Agency'));
  await user.type(screen.getByLabelText('Display name'), 'Ravi Realty');
  await user.type(screen.getByLabelText('Years of experience'), '8');
  await user.type(screen.getByLabelText('Specialisations'), 'Plots, Resale flats');
  await user.click(screen.getByText('Mohali'));
  await user.click(screen.getByLabelText('Sector 70'));
  await user.click(screen.getByRole('button', { name: 'Send for review' }));

  expect(await screen.findByText(/waiting for review/)).toBeInTheDocument();
  expect(sent).toEqual({
    type: 'agency',
    displayName: 'Ravi Realty',
    experienceYears: 8,
    specialisations: ['Plots', 'Resale flats'],
    locationIds: [SECTOR_70],
  });
});

test('CreateProfile, without an area, does not send and asks for one', async () => {
  signedIn([], 'professional');
  let posts = 0;
  server.use(
    http.get('/api/v1/accounts/me', NO_ACCOUNT),
    http.post('/api/v1/accounts/me', () => {
      posts += 1;
      return HttpResponse.json(account(), { status: 201 });
    }),
  );
  renderApp('/professional');
  const user = userEvent.setup();

  await user.type(await screen.findByLabelText('Display name'), 'Ravi Realty');
  await user.click(screen.getByRole('button', { name: 'Send for review' }));

  expect(await screen.findByText('Pick at least one area you serve.')).toBeInTheDocument();
  expect(posts).toBe(0);
});

test('ProfessionalPage, while pending, shows the waiting banner', async () => {
  signedIn(['profile.manage'], 'professional');
  server.use(http.get('/api/v1/accounts/me', () => HttpResponse.json(account())));

  renderApp('/professional');

  expect(await screen.findByText(/waiting for review/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Resubmit for review' })).not.toBeInTheDocument();
});

test('ProfessionalPage, when rejected, shows the reason and resubmits', async () => {
  signedIn(['profile.manage'], 'professional');
  let resubmitted = false;
  server.use(
    http.get('/api/v1/accounts/me', () =>
      HttpResponse.json(
        resubmitted
          ? account()
          : account({ status: 'rejected', rejectReason: 'Add your RERA number' }),
      ),
    ),
    http.post('/api/v1/accounts/me/resubmit', () => {
      resubmitted = true;
      return HttpResponse.json(account());
    }),
  );
  renderApp('/professional');
  const user = userEvent.setup();

  expect(await screen.findByText('Add your RERA number')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Resubmit for review' }));

  expect(await screen.findByText(/waiting for review/)).toBeInTheDocument();
  expect(resubmitted).toBe(true);
});

test('ProfessionalPage, when approved, edits without the slug and shows the public address', async () => {
  signedIn(['profile.manage'], 'professional');
  let patched: Record<string, unknown> = {};
  server.use(
    http.get('/api/v1/accounts/me', () => HttpResponse.json(account({ status: 'approved' }))),
    http.patch('/api/v1/accounts/me', async ({ request }) => {
      patched = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(account({ status: 'approved', about: 'Plots in Mohali' }));
    }),
  );
  renderApp('/professional');
  const user = userEvent.setup();

  expect(await screen.findByText(/is live/)).toBeInTheDocument();
  expect(screen.getByText('ravi-realty')).toBeInTheDocument();
  expect(screen.queryByLabelText('Profile address')).not.toBeInTheDocument();
  await user.type(screen.getByLabelText('About'), 'Plots in Mohali');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));

  expect(await screen.findByText('Saved')).toBeInTheDocument();
  expect(patched).toMatchObject({ about: 'Plots in Mohali', locationIds: [SECTOR_70] });
  expect(patched).not.toHaveProperty('slug');
});

test('ProfessionalPage, when suspended, shows the notice and no form', async () => {
  signedIn(['profile.manage'], 'professional');
  server.use(
    http.get('/api/v1/accounts/me', () => HttpResponse.json(account({ status: 'suspended' }))),
  );

  renderApp('/professional');

  expect(await screen.findByText(/suspended/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
});

test('ProfessionalPage, for a staff user, explains why there is no form', async () => {
  signedIn(['admin.account.review'], 'staff');
  server.use(http.get('/api/v1/accounts/me', NO_ACCOUNT));

  renderApp('/professional');

  expect(
    await screen.findByText(/Staff accounts can't have a professional profile/),
  ).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Send for review' })).not.toBeInTheDocument();
});
