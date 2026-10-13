import { expect, test } from 'vitest';
import { loadGatewayConfig } from './config.js';

const full = {
  PORT: '3000',
  CATALOG_URL: 'http://localhost:3002',
  CORS_ORIGINS: 'http://localhost:5173, http://localhost:5174',
  RATE_LIMIT_MAX: '300',
};

test('loadGatewayConfig, when every variable is set, returns routes and trimmed origins', () => {
  const config = loadGatewayConfig(full);

  expect(config.port).toBe(3000);
  expect(config.corsOrigins).toEqual(['http://localhost:5173', 'http://localhost:5174']);
  expect(config.routes).toEqual([{ prefix: '/api/v1/catalog', upstream: 'http://localhost:3002' }]);
});

test('loadGatewayConfig, when variables are missing, names all of them', () => {
  const env = { ...full, CATALOG_URL: undefined, PORT: ' ' };

  expect(() => loadGatewayConfig(env)).toThrow(/PORT.*CATALOG_URL/);
});

test('loadGatewayConfig, when RATE_LIMIT_MAX is not a number, throws', () => {
  expect(() => loadGatewayConfig({ ...full, RATE_LIMIT_MAX: 'many' })).toThrow(/RATE_LIMIT_MAX/);
});
