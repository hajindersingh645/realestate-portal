import { http, HttpResponse, server, fakeToken, TEST_USER } from '@hanu/web-kit/testing';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { NOTICE_ID, REFERENCE } from '../test/fixtures';
import { renderApp } from '../test/render';

const DETAILS = { error: { code: 'SIGNUP_DETAILS_REQUIRED', message: 'New number' } };

function authServer(known: boolean) {
  const logins: Record<string, unknown>[] = [];
  server.use(
    http.get('/api/v1/catalog/reference', () => HttpResponse.json(REFERENCE)),
    http.post('/api/v1/auth/otp', () => new HttpResponse(null, { status: 202 })),
    http.post('/api/v1/auth/login', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      logins.push(body);
      if (!known && body.name === undefined) return HttpResponse.json(DETAILS, { status: 400 });
      return HttpResponse.json({ accessToken: fakeToken([]), user: TEST_USER });
    }),
    http.get('/api/v1/users/me', () =>
      HttpResponse.json({ ...TEST_USER, registeredAs: 'buyer', permissions: [] }),
    ),
    http.get('/api/v1/accounts/me', () => HttpResponse.json({}, { status: 404 })),
  );
  return logins;
}

async function phoneAndCode() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Mobile number'), '9815020001');
  await user.click(screen.getByRole('button', { name: 'Send code' }));
  await user.type(await screen.findByLabelText('6-digit code'), '123456');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  return user;
}

test('SignInPage, for a known number, signs in with phone and code only', async () => {
  const logins = authServer(true);
  renderApp('/sign-in');

  await phoneAndCode();

  expect(await screen.findByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  expect(logins).toEqual([{ phone: '9815020001', code: '123456' }]);
});

test('SignInPage, for a new number signing up as a professional, sends the name, side, consent and notice id', async () => {
  const logins = authServer(false);
  renderApp('/sign-in');

  const user = await phoneAndCode();
  await user.type(await screen.findByLabelText('Your name'), 'Ravi');
  await user.click(screen.getByLabelText("I'm a real estate professional"));
  expect(screen.getByText('We use your phone number to sign you in.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', '/privacy');
  await user.click(screen.getByLabelText('I have read and agree to this notice'));
  await user.click(screen.getByRole('button', { name: 'Create account' }));

  await screen.findByRole('navigation', { name: 'Main' });
  expect(logins.at(-1)).toEqual({
    phone: '9815020001',
    code: '123456',
    name: 'Ravi',
    consent: true,
    noticeBlockId: NOTICE_ID,
    registeredAs: 'professional',
  });
});

test('SignInPage, for a new number without ticking the notice, does not send', async () => {
  const logins = authServer(false);
  renderApp('/sign-in');

  const user = await phoneAndCode();
  await user.type(await screen.findByLabelText('Your name'), 'Asha');
  await user.click(screen.getByRole('button', { name: 'Create account' }));

  expect(logins).toHaveLength(1);
});

test('SignInPage, with a wrong code, says so', async () => {
  authServer(true);
  server.use(
    http.post('/api/v1/auth/login', () =>
      HttpResponse.json({ error: { code: 'INVALID_OTP', message: 'x' } }, { status: 401 }),
    ),
  );
  renderApp('/sign-in');

  await phoneAndCode();

  expect(await screen.findByText('That code is wrong or has expired.')).toBeInTheDocument();
});
