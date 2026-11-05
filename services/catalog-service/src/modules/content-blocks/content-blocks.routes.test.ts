import { ConflictError, type Orm, type ServiceConfig } from '@hanu/service-kit';
import { createTestKeys, signTestToken } from '@hanu/service-kit/testing';
import { beforeEach, expect, test, vi } from 'vitest';
import { buildApp } from '../../app.js';
import * as service from './content-blocks.service.js';

vi.mock('./content-blocks.service.js');

const keys = createTestKeys();
const config = {
  serviceName: 'catalog-service',
  logLevel: 'silent',
  jwtPublicKey: keys.publicKeyPem,
  platform: {
    country: 'IN',
    currency: 'INR',
    locale: 'en-IN',
    timezone: 'Asia/Kolkata',
    areaBaseUnit: 'sqft',
  },
} as ServiceConfig;
const orm = { em: { fork: () => ({}) } } as unknown as Orm;
const URL = '/admin/content-blocks/signup.data_notice';
const BODY = {
  body: 'We store your phone number to…',
  links: [{ label: 'Privacy Policy', url: '/privacy' }],
};
const view = {
  id: '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c01',
  key: 'signup.data_notice',
  locale: 'en-IN',
  version: 2,
  ...BODY,
  createdAt: '2026-11-05T00:00:00.000Z',
};

async function token(perms = ['admin.settings.manage']): Promise<string> {
  return await signTestToken(keys.privateKey, { sub: 'u1', perms });
}

beforeEach(() => {
  vi.resetAllMocks();
});

test('POST /admin/content-blocks/:key, without a token, returns 401', async () => {
  const res = await buildApp({ orm, config }).inject({ method: 'POST', url: URL, payload: BODY });

  expect(res.statusCode).toBe(401);
});

test('POST /admin/content-blocks/:key, with a token lacking admin.settings.manage, returns 403', async () => {
  const res = await buildApp({ orm, config }).inject({
    method: 'POST',
    url: URL,
    payload: BODY,
    headers: { authorization: `Bearer ${await token(['admin.catalog.manage'])}` },
  });

  expect(res.statusCode).toBe(403);
});

test('POST /admin/content-blocks/:key, with a valid body, publishes in the platform locale and returns 201', async () => {
  vi.mocked(service.publishContentBlock).mockResolvedValue(view);

  const res = await buildApp({ orm, config }).inject({
    method: 'POST',
    url: URL,
    payload: BODY,
    headers: { authorization: `Bearer ${await token()}` },
  });

  expect(res.statusCode).toBe(201);
  expect(res.json()).toEqual(view);
  expect(vi.mocked(service.publishContentBlock)).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ userId: 'u1' }),
    { key: 'signup.data_notice', locale: 'en-IN', ...BODY },
  );
});

test('POST /admin/content-blocks/:key, with an empty body or an unknown key, returns 400', async () => {
  const headers = { authorization: `Bearer ${await token()}` };
  const app = buildApp({ orm, config });

  const empty = await app.inject({
    method: 'POST',
    url: URL,
    payload: { ...BODY, body: '' },
    headers,
  });
  const unknown = await app.inject({
    method: 'POST',
    url: '/admin/content-blocks/anything',
    payload: BODY,
    headers,
  });

  expect(empty.statusCode).toBe(400);
  expect(unknown.statusCode).toBe(400);
  expect(vi.mocked(service.publishContentBlock)).not.toHaveBeenCalled();
});

test('POST /admin/content-blocks/:key, when another version was saved at the same moment, returns 409', async () => {
  vi.mocked(service.publishContentBlock).mockRejectedValue(new ConflictError());

  const res = await buildApp({ orm, config }).inject({
    method: 'POST',
    url: URL,
    payload: BODY,
    headers: { authorization: `Bearer ${await token()}` },
  });

  expect(res.statusCode).toBe(409);
});

test('GET /admin/content-blocks, with the permission, lists every version for the platform locale', async () => {
  vi.mocked(service.listContentBlocks).mockResolvedValue([view]);

  const res = await buildApp({ orm, config }).inject({
    method: 'GET',
    url: '/admin/content-blocks',
    headers: { authorization: `Bearer ${await token()}` },
  });

  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ data: [view] });
  expect(vi.mocked(service.listContentBlocks)).toHaveBeenCalledWith(expect.anything(), 'en-IN');
});

test.each(['//evil.example/privacy', 'javascript:alert(1)', 'http://example.in'])(
  'POST /admin/content-blocks/:key, with the link address %s, returns 400',
  async (url) => {
    const app = buildApp({ orm, config });

    const res = await app.inject({
      method: 'POST',
      url: URL,
      payload: { ...BODY, links: [{ label: 'Privacy', url }] },
      headers: { authorization: `Bearer ${await token()}` },
    });

    expect(res.statusCode).toBe(400);
    expect(vi.mocked(service.publishContentBlock)).not.toHaveBeenCalled();
  },
);
