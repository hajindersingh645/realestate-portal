import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, server } from '@hanu/web-kit/testing';
import { expect, test } from 'vitest';
import { signedIn } from '../test/fixtures';
import { renderApp } from '../test/render';

test('MyProfilePage, after editing the name and email, saves both', async () => {
  signedIn([], 'buyer');
  let saved: unknown;
  server.use(
    http.patch('/api/v1/users/me', async ({ request }) => {
      saved = await request.json();
      return HttpResponse.json({
        id: 'u1',
        name: 'Asha K',
        phone: '+919815099999',
        email: 'asha@example.in',
        registeredAs: 'buyer',
        permissions: [],
      });
    }),
  );
  renderApp('/me');
  const user = userEvent.setup();

  const name = await screen.findByLabelText('Name');
  await user.clear(name);
  await user.type(name, 'Asha K');
  await user.type(screen.getByLabelText('Email (optional)'), 'asha@example.in');
  await user.click(screen.getByRole('button', { name: 'Save' }));

  expect(await screen.findByText('Saved')).toBeInTheDocument();
  expect(saved).toEqual({ name: 'Asha K', email: 'asha@example.in' });
});

test('MyProfilePage, for a professional sign-up without a profile yet, offers to create one', async () => {
  signedIn([], 'professional');

  renderApp('/me');

  expect(
    await screen.findByRole('link', { name: 'Create a professional profile' }),
  ).toHaveAttribute('href', '/professional');
});

test('MyProfilePage, for a buyer, does not offer a professional profile (one side per number)', async () => {
  signedIn(['requirement.create'], 'buyer');

  renderApp('/me');

  await screen.findByRole('heading', { name: 'My profile' });
  expect(
    screen.queryByRole('link', { name: 'Create a professional profile' }),
  ).not.toBeInTheDocument();
});

test('MyProfilePage, for a staff user, does not offer a professional profile', async () => {
  signedIn(['admin.catalog.manage'], 'staff');

  renderApp('/me');

  await screen.findByRole('heading', { name: 'My profile' });
  expect(
    screen.queryByRole('link', { name: 'Create a professional profile' }),
  ).not.toBeInTheDocument();
});
