import { screen } from '@testing-library/react';
import { http, HttpResponse, server } from '@hanu/web-kit/testing';
import { expect, test } from 'vitest';
import { account, requirement, signedIn } from '../test/fixtures';
import { renderApp } from '../test/render';

test('MyLeads, for a professional, lists unlocked buyers with a tap-to-call number', async () => {
  signedIn(['profile.manage', 'lead.unlock'], 'professional');
  server.use(
    http.get('/api/v1/accounts/me', () => HttpResponse.json(account({ status: 'approved' }))),
    http.get('/api/v1/lead/my-leads', () =>
      HttpResponse.json({
        data: [
          {
            ...requirement(),
            unlockId: 'u1',
            unlockedAt: 'x',
            buyer: { name: 'Asha', phone: '+919815012345' },
          },
        ],
        nextCursor: null,
      }),
    ),
  );

  renderApp('/leads');

  expect(await screen.findByText('Asha')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '+919815012345' })).toHaveAttribute(
    'href',
    'tel:+919815012345',
  );
  expect(screen.getByText(/Buy Flat in Sector 70/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'My leads' })).toBeInTheDocument();
});
