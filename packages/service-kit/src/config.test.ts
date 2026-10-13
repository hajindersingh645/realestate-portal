import { expect, test } from 'vitest';
import { loadConfig } from './config.js';

const full = {
  NODE_ENV: 'test',
  SERVICE_NAME: 'catalog-service',
  PORT: '3002',
  DATABASE_URL: 'postgresql://u:p@localhost:5433/db',
  DB_SCHEMA: 'catalog',
  RABBITMQ_URL: 'amqp://localhost',
  JWT_PUBLIC_KEY: '-----BEGIN PUBLIC KEY-----\\nabc\\n-----END PUBLIC KEY-----\\n',
  PLATFORM_COUNTRY: 'IN',
  PLATFORM_CURRENCY: 'INR',
  PLATFORM_LOCALE: 'en-IN',
  PLATFORM_TIMEZONE: 'Asia/Kolkata',
  PLATFORM_AREA_BASE_UNIT: 'sqft',
};

test('loadConfig, when every variable is set, returns a typed config', () => {
  const config = loadConfig(full);

  expect(config.port).toBe(3002);
  expect(config.platform.currency).toBe('INR');
  expect(config.logLevel).toBe('info');
});

test('loadConfig, when the key contains escaped newlines, restores real newlines', () => {
  const config = loadConfig(full);

  expect(config.jwtPublicKey).toContain('-----BEGIN PUBLIC KEY-----\nabc\n');
});

test('loadConfig, when several variables are missing or blank, names all of them', () => {
  const env = { ...full, DATABASE_URL: undefined, PLATFORM_CURRENCY: '  ' };

  expect(() => loadConfig(env)).toThrow(/DATABASE_URL.*PLATFORM_CURRENCY/);
});

test('loadConfig, when PORT is not a number, throws', () => {
  expect(() => loadConfig({ ...full, PORT: 'abc' })).toThrow(/PORT/);
});
