import type { AccountDecisionPayload, AccountStatus, EventEnvelope } from '@hanu/contracts';
import { sql, type Orm } from '@hanu/service-kit';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createNotificationOrm } from '../orm.js';
import type { SmsProvider } from '../providers/sms-provider.js';
import { handleAccountDecided } from './account-decided.js';

const DB_URL =
  process.env.TEST_NOTIFICATION_DATABASE_URL ??
  'postgresql://svc_notification:svc_notification@localhost:5433/real_estate_test';
const PHONE = '+919815020001';

let orm: Orm;
let sent: { to: string; body: string }[];
let owner: string;
const sms: SmsProvider = {
  send: (message) => {
    sent.push(message);
    return Promise.resolve({ providerMessageId: `p-${String(sent.length)}` });
  },
};

beforeAll(async () => {
  orm = await createNotificationOrm(DB_URL, 'notification');
  await orm.migrator.up();
});

beforeEach(async () => {
  sent = [];
  owner = randomUUID();
  await sql(orm.em.fork(), 'truncate notifications, recipients');
  await sql(
    orm.em.fork(),
    `insert into recipients (user_id, name, phone, updated_at) values (?, 'Ravi', ?, now())`,
    [owner, PHONE],
  );
});

afterAll(async () => {
  await orm.close();
});

function event(status: AccountStatus, reason: string | null = 'Add your RERA number') {
  const envelope: EventEnvelope<AccountDecisionPayload> = {
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    producer: 'identity-service',
    payload: { accountId: randomUUID(), ownerUserId: owner, status, reason },
  };
  return envelope;
}

async function handle(envelope: EventEnvelope<AccountDecisionPayload>): Promise<void> {
  await orm.em.fork().transactional((em) => handleAccountDecided(em, sms, 'en-IN', envelope));
}

test('handleAccountDecided, for an approval, texts the owner once and records it against them', async () => {
  await handle(event('approved', null));

  expect(sent).toEqual([
    {
      to: PHONE,
      body: 'Hanu.property: your professional profile is approved and now visible to buyers.',
      dltTemplateId: null,
    },
  ]);
  const rows = await sql<{ user_id: string; template_code: string; status: string }>(
    orm.em.fork(),
    'select user_id, template_code, status from notifications',
  );
  expect(rows).toEqual([{ user_id: owner, template_code: 'account.approved', status: 'sent' }]);
});

test.each([
  [
    'rejected',
    'was not approved. Reason: Add your RERA number. Edit it and resubmit from your dashboard.',
  ],
  ['suspended', 'is suspended. Reason: Add your RERA number.'],
  ['banned', 'has been closed. Reason: Add your RERA number.'],
] as const)('handleAccountDecided, for %s, sends the reason', async (status, text) => {
  await handle(event(status));

  expect(sent[0]?.body).toBe(`Hanu.property: your professional profile ${text}`);
});

test('handleAccountDecided, for the same event delivered twice, sends once', async () => {
  const twice = event('rejected');

  await handle(twice);
  await handle(twice);

  expect(sent).toHaveLength(1);
});

test('handleAccountDecided, for an owner whose details were erased, sends nothing and records it skipped', async () => {
  await sql(orm.em.fork(), 'update recipients set erased_at = now()');

  await handle(event('approved', null));

  expect(sent).toHaveLength(0);
  const rows = await sql<{ status: string }>(orm.em.fork(), 'select status from notifications');
  expect(rows).toEqual([{ status: 'skipped_no_recipient' }]);
});

test('handleAccountDecided, for an owner not copied here yet, throws so the broker retries, and records nothing', async () => {
  await sql(orm.em.fork(), 'truncate recipients');

  await expect(handle(event('approved', null))).rejects.toThrow(/recipient/);

  expect(sent).toHaveLength(0);
  expect(await sql(orm.em.fork(), 'select 1 from notifications')).toHaveLength(0);
});
