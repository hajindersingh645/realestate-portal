import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { useSession } from '@hanu/web-kit';
import { roles } from '../../test/access-fixtures';
import { renderApp } from '../../test/render';
import { fakeToken, http, HttpResponse, server, TEST_USER } from '@hanu/web-kit/testing';

test('RolesPage, opening a system role, shows its permissions read-only', async () => {
  useSession
    .getState()
    .signIn({ accessToken: fakeToken(['admin.access.manage']), user: TEST_USER });
  server.use(http.get('/api/v1/admin/identity/roles', () => HttpResponse.json({ data: roles })));
  renderApp('/access/roles');
  const user = userEvent.setup();

  await user.click(await screen.findByRole('button', { name: 'Actions for Super admin' }));
  await user.click(screen.getByRole('menuitem', { name: 'View' }));

  const dialog = screen.getByRole('dialog', { name: 'Super admin' });
  expect(within(dialog).getByRole('checkbox', { name: /admin\.catalog\.manage/ })).toBeChecked();
  expect(within(dialog).getByRole('checkbox', { name: /admin\.catalog\.manage/ })).toBeDisabled();
  expect(within(dialog).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
});

test('RolesPage, saving a custom role with one more permission, sends the full new set', async () => {
  let sent: unknown;
  useSession
    .getState()
    .signIn({ accessToken: fakeToken(['admin.access.manage']), user: TEST_USER });
  server.use(
    http.get('/api/v1/admin/identity/roles', () => HttpResponse.json({ data: roles })),
    http.patch(`/api/v1/admin/identity/roles/${roles[1]?.id ?? ''}`, async ({ request }) => {
      sent = await request.json();
      return HttpResponse.json(roles[1]);
    }),
  );
  renderApp('/access/roles');
  const user = userEvent.setup();

  await user.click(await screen.findByRole('button', { name: 'Actions for Catalog editor' }));
  await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
  const dialog = screen.getByRole('dialog', { name: 'Edit Catalog editor' });
  await user.click(within(dialog).getByRole('checkbox', { name: /admin\.audit\.view/ }));
  await user.click(within(dialog).getByRole('button', { name: 'Save' }));

  await screen.findByText('Role saved');
  expect(sent).toEqual({
    name: 'Catalog editor',
    permissions: ['admin.audit.view', 'admin.catalog.manage'],
  });
});
