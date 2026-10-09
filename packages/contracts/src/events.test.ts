import { expect, test } from 'vitest';
import { isEventEnvelope } from './events.js';

const valid = {
  eventId: '0b0f6a52-6f6e-4d0e-9a39-0d4b4f3f1a11',
  timestamp: '2026-10-09T10:00:00.000Z',
  producer: 'catalog-service',
  payload: { pingId: 'x' },
};

test('isEventEnvelope, when all four fields are present, returns true', () => {
  expect(isEventEnvelope(valid)).toBe(true);
});

test.each([
  ['null', null],
  ['a string', 'hello'],
  ['missing eventId', { ...valid, eventId: undefined }],
  ['numeric producer', { ...valid, producer: 7 }],
  ['payload not an object', { ...valid, payload: 'x' }],
  ['payload null', { ...valid, payload: null }],
])('isEventEnvelope, when given %s, returns false', (_name, value) => {
  expect(isEventEnvelope(value)).toBe(false);
});
