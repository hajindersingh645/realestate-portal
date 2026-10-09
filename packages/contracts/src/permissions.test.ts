import { expect, test } from 'vitest';
import { PERMISSIONS } from './permissions.js';

test('PERMISSIONS, as a list, has no duplicates', () => {
  expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
});

test('PERMISSIONS, every key, is lowercase dot-separated', () => {
  for (const key of PERMISSIONS) {
    const parts = key.split('.');

    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) expect(part).toMatch(/^[a-z_]+$/);
  }
});
