import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw/http';
import { expect, test } from 'vitest';
import { useSession } from '../../session/session-store';
import { renderApp } from '../../test/render';
import { server } from '../../test/server';
import { fakeToken, TEST_USER } from '../../test/tokens';
import { DiffView } from './DiffView';

function entry(id: string, action: string) {
  return {
    id,
    actorUserId: null,
    service: 'catalog-service',
    action,
    targetType: 'lookup',
    targetId: `t-${id}`,
    diff: { before: { label: '2 BHK' }, after: { label: '2 BHK flat' } },
    ip: null,
    createdAt: '2026-11-03T10:00:00.000Z',
  };
}

function signIn() {
  useSession.getState().signIn({ accessToken: fakeToken(['admin.audit.view']), user: TEST_USER });
}

test('AuditLogPage, with targetType=lookup in the URL, sends it and lists rows', async () => {
  const seen: string[] = [];
  server.use(
    http.get('/api/v1/admin/identity/audit-logs', ({ request }) => {
      seen.push(new URL(request.url).search);
      return HttpResponse.json({ data: [entry('a1', 'lookup.updated')], nextCursor: null });
    }),
  );
  signIn();

  renderApp('/access/audit-log?targetType=lookup');

  expect(await screen.findByText('lookup.updated')).toBeInTheDocument();
  expect(seen).toEqual(['?targetType=lookup']);
  expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
});

test('Load more, when clicked, requests the next cursor and appends rows', async () => {
  const seen: (string | null)[] = [];
  server.use(
    http.get('/api/v1/admin/identity/audit-logs', ({ request }) => {
      const cursor = new URL(request.url).searchParams.get('cursor');
      seen.push(cursor);
      return cursor === null
        ? HttpResponse.json({ data: [entry('a1', 'lookup.created')], nextCursor: 'c2' })
        : HttpResponse.json({ data: [entry('a2', 'lookup.deleted')], nextCursor: null });
    }),
  );
  signIn();
  renderApp('/access/audit-log');

  await userEvent.setup().click(await screen.findByRole('button', { name: 'Load more' }));

  expect(await screen.findByText('lookup.deleted')).toBeInTheDocument();
  expect(screen.getByText('lookup.created')).toBeInTheDocument();
  expect(seen).toEqual([null, 'c2']);
});

test('DiffView, for a renamed lookup, shows the old and new name', () => {
  render(
    <DiffView
      diff={{ before: { label: '2 BHK', sort: 1 }, after: { label: '2 BHK flat', sort: 1 } }}
    />,
  );

  expect(screen.getByRole('cell', { name: 'label' })).toBeInTheDocument();
  expect(screen.getByRole('cell', { name: '2 BHK' })).toBeInTheDocument();
  expect(screen.getByRole('cell', { name: '2 BHK flat' })).toBeInTheDocument();
  expect(screen.queryByRole('cell', { name: 'sort' })).not.toBeInTheDocument();
});
