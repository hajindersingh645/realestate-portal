import { screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { renderApp } from './test/render';

test('the app, at an unknown path, shows "Page not found" and a link home', () => {
  renderApp('/nowhere');

  expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/');
});
