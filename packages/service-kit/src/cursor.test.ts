import { expect, test } from 'vitest';
import { decodeCursor, encodeCursor } from './cursor.js';
import { ValidationError } from './errors.js';

test('encodeCursor then decodeCursor, for a row, gives back its created_at and id', () => {
  const cursor = encodeCursor(
    '2026-11-05T07:00:00.123456Z',
    '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c01',
  );

  expect(decodeCursor(cursor)).toEqual([
    '2026-11-05T07:00:00.123456Z',
    '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c01',
  ]);
});

test.each([
  '',
  'not-base64-at-all',
  Buffer.from('no-separator').toString('base64url'),
  Buffer.from('yesterday|x').toString('base64url'),
])('decodeCursor, for %j, throws ValidationError', (cursor) => {
  expect(() => decodeCursor(cursor)).toThrow(ValidationError);
});
