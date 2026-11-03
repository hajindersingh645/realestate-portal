import { expect, test } from 'vitest';
import { loadGatewayConfig } from './config.js';

const full = {
  PORT: '3000',
  CATALOG_URL: 'http://localhost:3002',
  IDENTITY_URL: 'http://localhost:3001',
  CORS_ORIGINS: 'http://localhost:5173, http://localhost:5174',
  RATE_LIMIT_MAX: '300',
  AUTH_RATE_LIMIT_MAX: '10',
  JWT_PUBLIC_KEY: 'line1\\nline2',
  RABBITMQ_URL: 'amqp://localhost',
};

test('loadGatewayConfig, when every variable is set, returns routes and trimmed origins', () => {
  const config = loadGatewayConfig(full);

  expect(config.port).toBe(3000);
  expect(config.corsOrigins).toEqual(['http://localhost:5173', 'http://localhost:5174']);
  expect(config.routes).toEqual([
    { prefix: '/api/v1/catalog', upstream: 'http://localhost:3002', rewritePrefix: '' },
    {
      prefix: '/api/v1/auth',
      upstream: 'http://localhost:3001',
      rewritePrefix: '/auth',
      rateLimitMax: 10,
    },
    { prefix: '/api/v1/users', upstream: 'http://localhost:3001', rewritePrefix: '/users' },
    {
      prefix: '/api/v1/admin/identity',
      upstream: 'http://localhost:3001',
      rewritePrefix: '/admin/identity',
    },
  ]);
  expect(config.jwtPublicKey).toBe('line1\nline2');
});

test('loadGatewayConfig, when variables are missing, names all of them', () => {
  const env = { ...full, CATALOG_URL: undefined, PORT: ' ' };

  expect(() => loadGatewayConfig(env)).toThrow(/PORT.*CATALOG_URL/);
});

test('loadGatewayConfig, when RATE_LIMIT_MAX is not a number, throws', () => {
  expect(() => loadGatewayConfig({ ...full, RATE_LIMIT_MAX: 'many' })).toThrow(/RATE_LIMIT_MAX/);
});
