import { expect, test } from 'vitest';
import { maskPhone } from '../delivery/mask.js';
import { ConsoleSmsProvider } from '../../providers/console-sms.js';
import { render } from './render.js';

test('render, with every placeholder given, fills them all', () => {
  expect(
    render(
      'Code {{code}}, {{minutes}} min',
      new Map([
        ['code', '123456'],
        ['minutes', '5'],
      ]),
    ),
  ).toBe('Code 123456, 5 min');
});

test('render, with a placeholder missing, throws instead of sending a blank', () => {
  expect(() => render('Hi {{name}}', new Map())).toThrow(/name/);
});

test('maskPhone, for an Indian mobile, keeps the country code and last four digits', () => {
  expect(maskPhone('+919815012345')).toBe('+91******2345');
});

test('ConsoleSmsProvider, in production, refuses to start', () => {
  expect(() => new ConsoleSmsProvider('production', () => undefined)).toThrow(/production/);
});

test('ConsoleSmsProvider, in development, logs the masked number and the text', async () => {
  const lines: string[] = [];
  const provider = new ConsoleSmsProvider('development', (line) => lines.push(line));

  await provider.send({ to: '+919815012345', body: 'Code 1' });

  expect(lines).toEqual(['sms to +91******2345: Code 1']);
});
