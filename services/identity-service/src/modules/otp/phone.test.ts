import { expect, test } from 'vitest';
import { normalisePhone } from './phone.js';

test('normalisePhone, for the usual ways of writing one mobile, returns the same E.164 number', () => {
  for (const input of [
    '98150 12345',
    '+91-98150-12345',
    '09815012345',
    '919815012345',
    '(98150) 12345',
  ]) {
    expect(normalisePhone(input, 'IN')).toBe('+919815012345');
  }
});

test('normalisePhone, for a landline length, a non-mobile prefix or letters, returns null', () => {
  for (const input of ['0172 2700000', '5815012345', '98150abcde', '981501234', '+1 9815012345']) {
    expect(normalisePhone(input, 'IN')).toBeNull();
  }
});

test('normalisePhone, for a country without rules, throws', () => {
  expect(() => normalisePhone('9815012345', 'GB')).toThrow(/GB/);
});
