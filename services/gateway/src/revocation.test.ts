import { expect, test } from 'vitest';
import { RevocationList } from './revocation.js';

const USER = '0b6c3f0e-6c1a-4b8e-9d2f-1a2b3c4d5e6f';
const CHANGED = new Date('2026-11-03T10:00:00.500Z');
const CHANGED_S = Math.floor(CHANGED.getTime() / 1000);

test('isRevoked, for a token issued before the change, is true', () => {
  const list = new RevocationList();

  list.record(USER, CHANGED, CHANGED.getTime());

  expect(list.isRevoked(USER, CHANGED_S - 1)).toBe(true);
});

test('isRevoked, for a token issued in the same second as the change or later, is false', () => {
  const list = new RevocationList();

  list.record(USER, CHANGED, CHANGED.getTime());

  expect(list.isRevoked(USER, CHANGED_S)).toBe(false);
  expect(list.isRevoked(USER, CHANGED_S + 60)).toBe(false);
});

test('record, when an older change arrives after a newer one, keeps the newer', () => {
  const list = new RevocationList();

  list.record(USER, CHANGED, CHANGED.getTime());
  list.record(USER, new Date(CHANGED.getTime() - 60_000), CHANGED.getTime());

  expect(list.isRevoked(USER, CHANGED_S - 1)).toBe(true);
});

test('record, for entries older than 10 minutes, prunes them', () => {
  const list = new RevocationList();
  list.record(USER, CHANGED, CHANGED.getTime());
  const later = CHANGED.getTime() + 11 * 60_000;

  list.record('other', new Date(later), later);

  expect(list.size).toBe(1);
  expect(list.isRevoked(USER, CHANGED_S - 1)).toBe(false);
});
