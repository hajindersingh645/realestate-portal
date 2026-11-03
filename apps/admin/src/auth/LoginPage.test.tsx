import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw/http';
import { expect, test } from 'vitest';
import { useSession } from '../session/session-store';
import { renderApp } from '../test/render';
import { server } from '../test/server';
import { fakeToken, TEST_USER } from '../test/tokens';

const CHALLENGE = '22222222-2222-4222-8222-222222222222';

function staffLogin(code = '123456') {
  server.use(
    http.post('/api/v1/auth/staff/login', () =>
      HttpResponse.json({ challengeId: CHALLENGE }, { status: 202 }),
    ),
    http.post('/api/v1/auth/staff/verify', async ({ request }) => {
      const body = (await request.json()) as { code: string };
      return body.code === code
        ? HttpResponse.json({ accessToken: fakeToken([]), user: TEST_USER })
        : HttpResponse.json(
            { error: { code: 'INVALID_OTP', message: 'Invalid code' } },
            { status: 401 },
          );
    }),
  );
}

async function signIn(code: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), 'admin@hanu.property');
  await user.type(screen.getByLabelText('Password'), 'simplepassword123');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.type(await screen.findByLabelText('6-digit code'), code);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

test('LoginPage, with a correct password and code, signs in and lands on next', async () => {
  staffLogin();
  renderApp('/login?next=/nowhere');

  await signIn('123456');

  expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  expect(useSession.getState().status).toBe('signed-in');
});

test('LoginPage, with a wrong code, shows the error and keeps the code step', async () => {
  staffLogin();
  renderApp('/login');

  await signIn('000000');

  expect(await screen.findByText('Email, password or code is wrong.')).toBeInTheDocument();
  expect(screen.getByLabelText('6-digit code')).toBeInTheDocument();
  expect(useSession.getState().status).toBe('signed-out');
});

test('LoginPage, with next=//evil.example, lands on home', async () => {
  staffLogin();
  renderApp('/login?next=//evil.example');

  await signIn('123456');

  expect(await screen.findByRole('heading', { name: /Welcome/ })).toBeInTheDocument();
});

test('a protected page, when signed out, redirects to login with next set', async () => {
  renderApp('/');

  expect(await screen.findByRole('heading', { name: 'Sign in to Hanu Admin' })).toBeInTheDocument();
});

test('the login page, when already signed in, goes straight home', async () => {
  useSession.getState().signIn({ accessToken: fakeToken([]), user: TEST_USER });

  renderApp('/login');

  expect(await screen.findByRole('heading', { name: /Welcome/ })).toBeInTheDocument();
});
