import { expect, test } from 'vitest';
import { uuidv7 } from './ids.js';

test('uuidv7, for any time, is a valid version 7 UUID', () => {
  expect(uuidv7()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('uuidv7, for a later millisecond, sorts after an earlier one', () => {
  const earlier = uuidv7(1_700_000_000_000);
  const later = uuidv7(1_700_000_000_001);

  expect(earlier < later).toBe(true);
  expect(earlier.slice(0, 13)).toBe('018bcfe5-6800');
});
