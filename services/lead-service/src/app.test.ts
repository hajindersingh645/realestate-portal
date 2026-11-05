import { expect, test } from 'vitest';
import { testApp } from './test/app.js';

test('GET /health, without a token, returns 200', async () => {
  const { app } = await testApp();

  const res = await app.inject({ method: 'GET', url: '/health' });

  expect(res.statusCode).toBe(200);
});
