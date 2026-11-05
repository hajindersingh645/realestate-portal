import { render, screen, waitFor } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Dialog } from './Dialog';

function view(open: boolean) {
  return (
    <Dialog open={open} onClose={() => undefined} title="Menu" variant="drawer">
      <a href="/me">My profile</a>
    </Dialog>
  );
}

test('Dialog, when closed, leaves the accessibility tree at once and the page after its exit animation', async () => {
  const { rerender } = render(view(true));
  expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument();

  rerender(view(false));

  expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument();
  expect(document.querySelector('[data-closing]')).not.toBeNull();
  await waitFor(() => {
    expect(document.querySelector('[data-closing]')).toBeNull();
  });
  expect(screen.queryByText('My profile')).not.toBeInTheDocument();
});

test('Dialog, reopened while still closing, is shown again', () => {
  const { rerender } = render(view(true));

  rerender(view(false));
  rerender(view(true));

  expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument();
  expect(document.querySelector('[data-closing]')).toBeNull();
});
