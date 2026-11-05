import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw/http';
import { expect, test } from 'vitest';
import { useSession } from '../session/session-store';
import { renderApp } from '../test/render';
import { server } from '../test/server';
import { fakeToken, TEST_USER } from '../test/tokens';

function signInWith(perms: string[]) {
  useSession.getState().signIn({ accessToken: fakeToken(perms), user: TEST_USER });
}

test('the sidebar, for a user with only admin.catalog.manage, shows the Catalog items and hides the Access group', () => {
  signInWith(['admin.catalog.manage']);

  renderApp('/');

  const nav = screen.getByRole('navigation', { name: 'Main' });
  expect(within(nav).getByRole('link', { name: 'Locations' })).toHaveAttribute(
    'href',
    '/catalog/locations',
  );
  expect(within(nav).getByRole('link', { name: 'Lookups' })).toBeInTheDocument();
  expect(within(nav).queryByText('Access')).not.toBeInTheDocument();
  expect(within(nav).queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
});

test('the sidebar, after signIn with new perms, shows the newly allowed items without a reload', () => {
  signInWith(['admin.catalog.manage']);
  renderApp('/');

  act(() => {
    signInWith(['admin.catalog.manage', 'admin.user.manage', 'admin.audit.view']);
  });

  const nav = screen.getByRole('navigation', { name: 'Main' });
  expect(within(nav).getByRole('link', { name: 'Users' })).toBeInTheDocument();
  expect(within(nav).getByRole('link', { name: 'Audit log' })).toBeInTheDocument();
  expect(within(nav).queryByRole('link', { name: 'Roles' })).not.toBeInTheDocument();
});

test('the mobile drawer, opened from the menu button and closed by Escape, returns focus to the menu button', async () => {
  signInWith(['admin.catalog.manage']);
  renderApp('/');
  const user = userEvent.setup();
  const menuButton = screen.getByRole('button', { name: 'Open menu' });

  await user.click(menuButton);
  const drawer = screen.getByRole('dialog', { name: 'Menu' });
  expect(within(drawer).getByRole('link', { name: 'Locations' })).toBeInTheDocument();
  await user.keyboard('{Escape}');

  expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument();
  expect(menuButton).toHaveFocus();
});

test('Sign out, when clicked, calls /auth/logout and lands on the login page', async () => {
  let loggedOut = false;
  server.use(
    http.post('/api/v1/auth/logout', () => {
      loggedOut = true;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  signInWith(['admin.catalog.manage']);
  renderApp('/');

  await userEvent.setup().click(screen.getByRole('button', { name: 'Sign out' }));

  expect(await screen.findByRole('heading', { name: 'Sign in to Hanu Admin' })).toBeInTheDocument();
  expect(loggedOut).toBe(true);
});

test('the home page, for a catalog-only user, greets them and links only to catalog sections', () => {
  signInWith(['admin.catalog.manage']);

  renderApp('/');

  const main = screen.getByRole('main');
  expect(within(main).getByRole('heading', { name: 'Welcome, Asha Admin' })).toBeInTheDocument();
  expect(
    within(main).getByRole('link', { name: /Sectors and cities|Locations/ }),
  ).toBeInTheDocument();
  expect(within(main).queryByRole('link', { name: /Users/ })).not.toBeInTheDocument();
});
