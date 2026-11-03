import { expect, test } from 'vitest';
import { loadIdentityConfig } from './load-config.js';

const base = {
  SERVICE_NAME: 'identity-service',
  PORT: '3001',
  DATABASE_URL: 'postgresql://u:p@localhost:5433/db',
  DB_SCHEMA: 'identity',
  RABBITMQ_URL: 'amqp://localhost',
  JWT_PUBLIC_KEY: 'pub',
  JWT_PRIVATE_KEY: 'line1\\nline2',
  OTP_SECRET: 'x'.repeat(32),
  ADMIN_URL: 'http://localhost:5174',
  PLATFORM_COUNTRY: 'IN',
  PLATFORM_CURRENCY: 'INR',
  PLATFORM_LOCALE: 'en-IN',
  PLATFORM_TIMEZONE: 'Asia/Kolkata',
  PLATFORM_AREA_BASE_UNIT: 'sqft',
};

test('loadIdentityConfig, with every variable set, restores newlines in the private key', () => {
  expect(loadIdentityConfig(base).jwtPrivateKey).toBe('line1\nline2');
});

test('loadIdentityConfig, without JWT_PRIVATE_KEY, throws', () => {
  expect(() => loadIdentityConfig({ ...base, JWT_PRIVATE_KEY: '' })).toThrow(/JWT_PRIVATE_KEY/);
});

test('loadIdentityConfig, when OTP_SECRET is shorter than 32 characters, throws', () => {
  expect(() => loadIdentityConfig({ ...base, OTP_SECRET: 'short' })).toThrow(/OTP_SECRET/);
});
