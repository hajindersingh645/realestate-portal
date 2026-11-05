import { expect, test } from 'vitest';
import { loadLeadConfig } from './load-config.js';

const full = {
  NODE_ENV: 'test',
  SERVICE_NAME: 'lead-service',
  PORT: '3003',
  DATABASE_URL: 'postgresql://u:p@localhost:5433/db',
  DB_SCHEMA: 'lead',
  RABBITMQ_URL: 'amqp://localhost',
  JWT_PUBLIC_KEY: 'key',
  PLATFORM_COUNTRY: 'IN',
  PLATFORM_CURRENCY: 'INR',
  PLATFORM_LOCALE: 'en-IN',
  PLATFORM_TIMEZONE: 'Asia/Kolkata',
  PLATFORM_AREA_BASE_UNIT: 'sqft',
  IDENTITY_INTERNAL_URL: 'http://localhost:3001/',
  CATALOG_INTERNAL_URL: 'http://localhost:3002',
};

test('loadLeadConfig, when every variable is set, returns the internal URLs without a trailing slash', () => {
  const config = loadLeadConfig(full);

  expect(config.identityInternalUrl).toBe('http://localhost:3001');
  expect(config.catalogInternalUrl).toBe('http://localhost:3002');
});

test('loadLeadConfig, without IDENTITY_INTERNAL_URL, throws naming it', () => {
  expect(() => loadLeadConfig({ ...full, IDENTITY_INTERNAL_URL: ' ' })).toThrow(
    'Missing environment variables: IDENTITY_INTERNAL_URL',
  );
});
