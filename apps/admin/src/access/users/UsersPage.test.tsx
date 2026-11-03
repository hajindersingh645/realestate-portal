import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw/http';
import { beforeEach, expect, test } from 'vitest';
import { useSession } from '../../session/session-store';
import { EDITOR_ROLE, roles, STAFF_ID } from '../../test/access-fixtures';
import { renderApp } from '../../test/render';
import { server } from '../../test/server';
import { fakeToken, TEST_USER } from '../../test/tokens';

beforeEach(() => {
  useSession.getState().signIn({
    accessToken: fakeToken(['admin.user.manage', 'admin.access.manage']),
    user: TEST_USER,
  });
  server.use(
    http.get('/api/v1/admin/identity/users', () => HttpResponse.json({ data: [] })),
    http.get('/api/v1/admin/identity/roles', () => HttpResponse.json({ data: roles })),
  );
});

async function fillStaff() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Add staff' }));
  const dialog = screen.getByRole('dialog', { name: 'Add staff member' });
  await user.type(within(dialog).getByLabelText('Name'), 'Priya Staff');
  await user.type(within(dialog).getByLabelText('Work email'), 'priya@hanu.property');
  await user.type(within(dialog).getByLabelText('Mobile number'), '9815012345');
  await user.click(await within(dialog).findByRole('checkbox', { name: /Catalog editor/ }));
  await user.click(within(dialog).getByRole('button', { name: 'Add staff member' }));
  return { user, dialog };
}

test('AddStaffDialog, on success, shows the setup link with a Copy button and does not close until Done', async () => {
  let sent: unknown;
  server.use(
    http.post('/api/v1/admin/identity/staff', async ({ request }) => {
      sent = await request.json();
      return HttpResponse.json(
        {
          userId: STAFF_ID,
          setupUrl: 'http://localhost:5174/setup?token=abc',
          expiresAt: '2026-11-06T10:00:00.000Z',
        },
        { status: 201 },
      );
    }),
  );
  renderApp('/access/users');

  const { user } = await fillStaff();

  const done = await screen.findByRole('dialog', { name: 'Staff member added' });
  expect(
    within(done).getByDisplayValue('http://localhost:5174/setup?token=abc'),
  ).toBeInTheDocument();
  expect(within(done).getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
  expect(sent).toEqual({
    name: 'Priya Staff',
    email: 'priya@hanu.property',
    phone: '9815012345',
    roleIds: [EDITOR_ROLE],
  });
  await user.keyboard('{Escape}');
  expect(screen.getByRole('dialog', { name: 'Staff member added' })).toBeInTheDocument();
  await user.click(within(done).getByRole('button', { name: 'Done' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('AddStaffDialog, when the email already exists, shows the 409 message and keeps the inputs', async () => {
  server.use(
    http.post('/api/v1/admin/identity/staff', () =>
      HttpResponse.json(
        { error: { code: 'CONFLICT', message: 'A user with this phone or email already exists' } },
        { status: 409 },
      ),
    ),
  );
  renderApp('/access/users');

  const { dialog } = await fillStaff();

  expect(
    await within(dialog).findByText('A user with this phone or email already exists'),
  ).toBeInTheDocument();
  expect(within(dialog).getByLabelText('Work email')).toHaveValue('priya@hanu.property');
});
