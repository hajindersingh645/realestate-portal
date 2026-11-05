import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { useSession } from '@hanu/web-kit';
import { roles, staffDetail, STAFF_ID } from '../../test/access-fixtures';
import { renderApp } from '../../test/render';
import { fakeToken, http, HttpResponse, server, TEST_USER } from '@hanu/web-kit/testing';

function setup(perms: string[]) {
  useSession.getState().signIn({ accessToken: fakeToken(perms), user: TEST_USER });
  server.use(
    http.get(`/api/v1/admin/identity/users/${STAFF_ID}`, () => HttpResponse.json(staffDetail())),
    http.get('/api/v1/admin/identity/roles', () => HttpResponse.json({ data: roles })),
  );
  renderApp(`/access/users/${STAFF_ID}`);
}

test('UserDetailPage, suspending without a reason, keeps Confirm disabled', async () => {
  setup(['admin.user.manage', 'admin.access.manage']);
  const user = userEvent.setup();

  await user.click(await screen.findByRole('button', { name: 'Suspend' }));

  const dialog = screen.getByRole('dialog', { name: 'Suspend Priya Staff?' });
  expect(within(dialog).getByRole('button', { name: 'Suspend' })).toBeDisabled();
  await user.type(within(dialog).getByLabelText('Reason'), 'Left the company');
  expect(within(dialog).getByRole('button', { name: 'Suspend' })).toBeEnabled();
});

test('UserDetailPage, when the server answers 409 SELF_CHANGE, shows "You can\'t change your own access"', async () => {
  setup(['admin.user.manage', 'admin.access.manage']);
  server.use(
    http.post(`/api/v1/admin/identity/users/${STAFF_ID}/status`, () =>
      HttpResponse.json(
        { error: { code: 'SELF_CHANGE', message: 'You cannot change your own access or status' } },
        { status: 409 },
      ),
    ),
  );
  const user = userEvent.setup();

  await user.click(await screen.findByRole('button', { name: 'Suspend' }));
  const dialog = screen.getByRole('dialog', { name: 'Suspend Priya Staff?' });
  await user.type(within(dialog).getByLabelText('Reason'), 'Testing');
  await user.click(within(dialog).getByRole('button', { name: 'Suspend' }));

  expect(await within(dialog).findByText("You can't change your own access")).toBeInTheDocument();
});

test('UserDetailPage, for a user without admin.access.manage, hides role and override controls', async () => {
  setup(['admin.user.manage']);

  expect(await screen.findByRole('heading', { name: 'Priya Staff' })).toBeInTheDocument();
  expect(screen.getByText('Catalog editor')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add role' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add override' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Remove Catalog editor/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'New setup link' })).not.toBeInTheDocument();
});

test('UserDetailPage, New setup link, shows the new link to copy', async () => {
  setup(['admin.user.manage', 'admin.access.manage']);
  server.use(
    http.post(`/api/v1/admin/identity/staff/${STAFF_ID}/setup-link`, () =>
      HttpResponse.json(
        {
          setupUrl: 'http://localhost:5174/setup?token=new',
          expiresAt: '2026-11-06T10:00:00.000Z',
        },
        { status: 201 },
      ),
    ),
  );
  const user = userEvent.setup();

  await user.click(await screen.findByRole('button', { name: 'New setup link' }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Create link' }));

  expect(
    await screen.findByDisplayValue('http://localhost:5174/setup?token=new'),
  ).toBeInTheDocument();
});
