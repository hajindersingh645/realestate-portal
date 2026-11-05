import { useSession } from '@hanu/web-kit';
import { fakeToken, http, HttpResponse, server, TEST_USER } from '@hanu/web-kit/testing';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { renderApp } from '../test/render';

const block = (version: number, body: string) => ({
  id: `7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c0${String(version)}`,
  key: 'signup.data_notice',
  locale: 'en-IN',
  version,
  body,
  links: [{ label: 'Privacy policy', url: '/privacy' }],
  createdAt: '2026-11-05T07:00:00.000000Z',
});

test('ContentPage, publishing a new version, sends the body and links and shows it as current', async () => {
  let sent: unknown;
  let published = false;
  server.use(
    http.get('/api/v1/catalog/admin/content-blocks', () =>
      HttpResponse.json({
        data: published ? [block(2, 'New text'), block(1, 'Old text')] : [block(1, 'Old text')],
      }),
    ),
    http.post('/api/v1/catalog/admin/content-blocks/signup.data_notice', async ({ request }) => {
      sent = await request.json();
      published = true;
      return HttpResponse.json(block(2, 'New text'), { status: 201 });
    }),
  );
  useSession
    .getState()
    .signIn({ accessToken: fakeToken(['admin.settings.manage']), user: TEST_USER });
  renderApp('/content');
  const user = userEvent.setup();

  const body = await screen.findByLabelText('Text');
  expect(body).toHaveValue('Old text');
  await user.clear(body);
  await user.type(body, 'New text');
  await user.type(screen.getByLabelText('Link 2 label'), 'Terms');
  await user.type(screen.getByLabelText('Link 2 address'), '/terms');
  await user.click(screen.getByRole('button', { name: 'Publish version 2' }));

  expect(await screen.findByText('Version 2 (current)')).toBeInTheDocument();
  expect(sent).toEqual({
    body: 'New text',
    links: [
      { label: 'Privacy policy', url: '/privacy' },
      { label: 'Terms', url: '/terms' },
    ],
  });
});

test('ContentPage, with a link address that is not / or https://, does not publish', async () => {
  let posts = 0;
  server.use(
    http.get('/api/v1/catalog/admin/content-blocks', () =>
      HttpResponse.json({ data: [block(1, 'Old text')] }),
    ),
    http.post('/api/v1/catalog/admin/content-blocks/signup.data_notice', () => {
      posts += 1;
      return HttpResponse.json(block(2, 'x'), { status: 201 });
    }),
  );
  useSession
    .getState()
    .signIn({ accessToken: fakeToken(['admin.settings.manage']), user: TEST_USER });
  renderApp('/content');
  const user = userEvent.setup();

  await user.type(await screen.findByLabelText('Link 2 label'), 'Evil');
  await user.type(screen.getByLabelText('Link 2 address'), 'javascript:alert(1)');
  await user.click(screen.getByRole('button', { name: 'Publish version 2' }));

  expect(
    await screen.findByText('Links must start with / or https://, and each needs a label.'),
  ).toBeInTheDocument();
  expect(posts).toBe(0);
});
