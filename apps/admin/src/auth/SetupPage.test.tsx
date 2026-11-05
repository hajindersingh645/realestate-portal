import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { renderApp } from '../test/render';
import { http, HttpResponse, server } from '@hanu/web-kit/testing';

async function submit(password: string, confirm: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('New password'), password);
  await user.type(screen.getByLabelText('Confirm password'), confirm);
  await user.click(screen.getByRole('button', { name: 'Set password' }));
}

test('SetupPage, when passwords differ, shows "Passwords do not match" and sends nothing', async () => {
  let calls = 0;
  server.use(
    http.post('/api/v1/auth/staff/setup', () => {
      calls += 1;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  renderApp('/setup?token=abc');

  await submit('a long enough password', 'a different password!');

  expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
  expect(calls).toBe(0);
});

test('SetupPage, with a used token, shows the expired-link message', async () => {
  server.use(
    http.post('/api/v1/auth/staff/setup', () =>
      HttpResponse.json(
        {
          error: {
            code: 'SETUP_LINK_INVALID',
            message: 'This link has expired or was already used',
          },
        },
        { status: 400 },
      ),
    ),
  );
  renderApp('/setup?token=abc');

  await submit('a long enough password', 'a long enough password');

  expect(
    await screen.findByText(
      'This link has expired or was already used. Ask your admin for a new one.',
    ),
  ).toBeInTheDocument();
});

test('SetupPage, with a valid token, sends it with the password and offers sign in', async () => {
  let sent: unknown;
  server.use(
    http.post('/api/v1/auth/staff/setup', async ({ request }) => {
      sent = await request.json();
      return new HttpResponse(null, { status: 204 });
    }),
  );
  renderApp('/setup?token=abc');

  await submit('a long enough password', 'a long enough password');

  expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  expect(sent).toEqual({ token: 'abc', password: 'a long enough password' });
});

test('SetupPage, without a token in the link, explains the link is incomplete', () => {
  renderApp('/setup');

  expect(
    screen.getByText(
      'This link is incomplete. Open the full link you were sent, or ask your admin for a new one.',
    ),
  ).toBeInTheDocument();
});
