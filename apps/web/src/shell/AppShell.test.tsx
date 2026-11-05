import { screen, within } from '@testing-library/react';
import { http, server } from '@hanu/web-kit/testing';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { NO_ACCOUNT, signedIn } from '../test/fixtures';
import { renderApp } from '../test/render';

test('the sidebar, for a buyer, shows only My profile', async () => {
  signedIn(['requirement.create'], 'buyer');

  renderApp('/me');

  const nav = await screen.findByRole('navigation', { name: 'Main' });
  expect(
    within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent),
  ).toEqual(['My profile']);
});

test('the sidebar, for a professional without an account yet, also shows Professional profile', async () => {
  signedIn([], 'professional');
  server.use(http.get('/api/v1/accounts/me', NO_ACCOUNT));

  renderApp('/me');

  const nav = await screen.findByRole('navigation', { name: 'Main' });
  expect(await within(nav).findByRole('link', { name: 'Professional profile' })).toHaveAttribute(
    'href',
    '/professional',
  );
});

test('the app, when signed out, sends the user to sign in', async () => {
  renderApp('/me');

  expect(await screen.findByRole('button', { name: 'Send code' })).toBeInTheDocument();
});

test('the phone menu, from Open menu, shows the same links in a drawer and closes after following one', async () => {
  signedIn([], 'professional');
  server.use(http.get('/api/v1/accounts/me', NO_ACCOUNT));
  renderApp('/me');
  const user = userEvent.setup();

  await user.click(await screen.findByRole('button', { name: 'Open menu' }));
  const drawer = screen.getByRole('dialog', { name: 'Menu' });
  expect(within(drawer).getByRole('link', { name: 'My profile' })).toBeInTheDocument();
  await user.click(await within(drawer).findByRole('link', { name: 'Professional profile' }));

  expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument();
  expect(
    await screen.findByRole('heading', { name: 'Create your professional profile' }),
  ).toBeInTheDocument();
});
