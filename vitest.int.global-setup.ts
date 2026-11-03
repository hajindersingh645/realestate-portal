// Integration tests use their own RabbitMQ virtual host, so test queues and messages never mix
// with the dev services' ones. Creating it again is a no-op.
const MANAGEMENT_URL = process.env.TEST_RABBITMQ_MANAGEMENT_URL ?? 'http://localhost:15672';
const AUTH = `Basic ${Buffer.from('guest:guest').toString('base64')}`;

async function put(path: string, body: object): Promise<void> {
  const response = await fetch(`${MANAGEMENT_URL}${path}`, {
    method: 'PUT',
    headers: { authorization: AUTH, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`RabbitMQ management ${path}: ${String(response.status)}`);
}

export default async function setup(): Promise<void> {
  await put('/api/vhosts/test', {});
  await put('/api/permissions/test/guest', { configure: '.*', write: '.*', read: '.*' });
}
