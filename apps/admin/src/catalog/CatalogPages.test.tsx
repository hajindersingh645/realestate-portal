import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test } from 'vitest';
import { useSession } from '@hanu/web-kit';
import { location, MOHALI, PUNJAB } from '../test/catalog-fixtures';
import { renderApp } from '../test/render';
import { fakeToken, http, HttpResponse, server, TEST_USER } from '@hanu/web-kit/testing';

beforeEach(() => {
  useSession
    .getState()
    .signIn({ accessToken: fakeToken(['admin.catalog.manage']), user: TEST_USER });
});

function locationsApi(seen: string[] = []) {
  server.use(
    http.get('/api/v1/catalog/admin/locations', ({ request }) => {
      const url = new URL(request.url);
      seen.push(url.search);
      const type = url.searchParams.get('type');
      if (type === 'city')
        return HttpResponse.json({
          data: [location({ id: MOHALI, name: 'Mohali', type: 'city', parentId: PUNJAB })],
        });
      if (type === 'locality') {
        return HttpResponse.json({
          data: [
            location({ id: 'l1', name: 'Sector 70', type: 'locality', parentId: MOHALI }),
            location({ id: 'l2', name: 'Sector 71', type: 'locality', parentId: MOHALI }),
          ],
        });
      }
      return HttpResponse.json({
        data: [location({ id: PUNJAB, name: 'Punjab', type: 'state', code: 'PB' })],
      });
    }),
  );
  return seen;
}

test('LocationsPage, with ?type=locality&parentId=<mohali>, requests exactly that filter and shows "Localities 2"', async () => {
  const seen = locationsApi();

  renderApp(`/catalog/locations?type=locality&parentId=${MOHALI}`);

  expect(await screen.findByRole('heading', { name: 'Localities 2' })).toBeInTheDocument();
  expect(seen).toContain(`?type=locality&parentId=${MOHALI}`);
  expect(screen.getByRole('cell', { name: 'Sector 70' })).toBeInTheDocument();
});

test('LocationsPage, when the server returns 409 for a duplicate slug, shows the message under Slug and keeps the dialog open with the input', async () => {
  locationsApi();
  server.use(
    http.post('/api/v1/catalog/admin/locations', () =>
      HttpResponse.json(
        { error: { code: 'CONFLICT', message: 'A location with this slug already exists here' } },
        { status: 409 },
      ),
    ),
  );
  renderApp('/catalog/locations');
  const user = userEvent.setup();

  await user.click(await screen.findByRole('button', { name: 'Add state' }));
  const dialog = screen.getByRole('dialog', { name: 'Add state' });
  await user.type(within(dialog).getByLabelText('Name'), 'Punjab');
  await user.type(within(dialog).getByLabelText('Slug'), 'punjab');
  await user.click(within(dialog).getByRole('button', { name: 'Save' }));

  expect(
    await within(dialog).findByText('A location with this slug already exists here'),
  ).toBeInTheDocument();
  expect(within(dialog).getByLabelText('Slug')).toHaveValue('punjab');
  expect(screen.getByRole('dialog', { name: 'Add state' })).toBeInTheDocument();
});

test('PropertyTypesPage, after Deactivate, shows INACTIVE on the row', async () => {
  let active = true;
  let patched: unknown;
  server.use(
    http.get('/api/v1/catalog/admin/property-types', () =>
      HttpResponse.json({
        data: [
          {
            id: 'p1',
            parentId: null,
            slug: 'flat',
            name: 'Flat',
            kind: 'flat',
            isActive: active,
            sort: 0,
          },
        ],
      }),
    ),
    http.patch('/api/v1/catalog/admin/property-types/p1', async ({ request }) => {
      patched = await request.json();
      active = false;
      return HttpResponse.json({
        id: 'p1',
        parentId: null,
        slug: 'flat',
        name: 'Flat',
        kind: 'flat',
        isActive: false,
        sort: 0,
      });
    }),
  );
  renderApp('/catalog/property-types');
  const user = userEvent.setup();

  await user.click(await screen.findByRole('button', { name: 'Actions for Flat' }));
  await user.click(screen.getByRole('menuitem', { name: 'Deactivate' }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Deactivate' }));

  expect(await screen.findByText('Inactive')).toBeInTheDocument();
  expect(patched).toEqual({ isActive: false });
});

test('LookupsPage, switching the group tab, updates the URL and the request', async () => {
  const seen: string[] = [];
  server.use(
    http.get('/api/v1/catalog/admin/lookups', ({ request }) => {
      const group = new URL(request.url).searchParams.get('group');
      seen.push(group ?? '');
      return HttpResponse.json({
        data: [
          {
            id: `x-${group ?? ''}`,
            group,
            code: 'east',
            label: group === 'facing' ? 'East' : '2 BHK',
            meta: null,
            isActive: true,
            sort: 0,
          },
        ],
      });
    }),
  );
  renderApp('/catalog/lookups');
  const user = userEvent.setup();
  await screen.findByRole('cell', { name: '2 BHK' });

  await user.click(screen.getByRole('button', { name: 'Facing' }));

  expect(await screen.findByRole('cell', { name: 'East' })).toBeInTheDocument();
  expect(seen).toEqual(['bhk', 'facing']);
});

test('UnitConversionsPage, with no rows, shows the empty state with an Add button', async () => {
  server.use(
    http.get('/api/v1/catalog/admin/unit-conversions', () => HttpResponse.json({ data: [] })),
    http.get('/api/v1/catalog/admin/lookups', () => HttpResponse.json({ data: [] })),
    http.get('/api/v1/catalog/admin/locations', () => HttpResponse.json({ data: [] })),
  );

  renderApp('/catalog/unit-conversions');

  expect(await screen.findByText('No unit conversions yet')).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getAllByRole('button', { name: 'Add conversion' }).length).toBeGreaterThan(0);
  });
});
