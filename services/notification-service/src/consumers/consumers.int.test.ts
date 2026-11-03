import type { EventEnvelope, OtpRequestedPayload, UserContactPayload } from '@hanu/contracts';
import { sql, type Orm } from '@hanu/service-kit';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createNotificationOrm } from '../orm.js';
import type { SmsProvider } from '../providers/sms-provider.js';
import { handleOtpRequested } from './otp-requested.js';
import { upsertRecipient } from './user-contact.js';

const DB_URL =
  process.env.TEST_NOTIFICATION_DATABASE_URL ??
  'postgresql://svc_notification:svc_notification@localhost:5433/real_estate_test';

let orm: Orm;
let sent: { to: string; body: string }[];
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
  await sql(orm.em.fork(), 'truncate notifications, recipients');
});

afterAll(async () => {
  await orm.close();
});

function otpEvent(minutesLeft = 5): EventEnvelope<OtpRequestedPayload> {
  const now = Date.now();
  return {
    eventId: randomUUID(),
    timestamp: new Date(now).toISOString(),
    producer: 'identity-service',
    payload: {
      challengeId: randomUUID(),
      phone: '+919815012345',
      code: '482913',
      purpose: 'login',
      expiresAt: new Date(now + minutesLeft * 60_000).toISOString(),
      locale: 'en-IN',
    },
  };
}

async function handle(
  event: EventEnvelope<OtpRequestedPayload>,
  provider: SmsProvider = sms,
): Promise<void> {
  await orm.em.fork().transactional((em) => handleOtpRequested(em, provider, event));
}

async function statuses(): Promise<string[]> {
  return (await sql<{ status: string }>(orm.em.fork(), 'select status from notifications')).map(
    (r) => r.status,
  );
}

test('handleOtpRequested, for a live code, sends one SMS with the code and stores no number in clear', async () => {
  await handle(otpEvent());

  expect(sent).toEqual([
    {
      to: '+919815012345',
      body: 'Your Hanu.property code is 482913. It expires in 5 minutes. Do not share it.',
      dltTemplateId: null,
    },
  ]);
  const rows = await sql<{ phone_masked: string; provider_message_id: string }>(
    orm.em.fork(),
    'select phone_masked, provider_message_id from notifications',
  );
  expect(rows).toEqual([{ phone_masked: '+91******2345', provider_message_id: 'p-1' }]);
});

test('handleOtpRequested, for the same event delivered twice, sends once', async () => {
  const event = otpEvent();

  await handle(event);
  await handle(event);

  expect(sent).toHaveLength(1);
});

test('handleOtpRequested, for a code already expired on arrival, sends nothing and records it skipped', async () => {
  await handle(otpEvent(-1));

  expect(sent).toHaveLength(0);
  expect(await statuses()).toEqual(['skipped_expired']);
});

test('handleOtpRequested, when the provider fails, throws and keeps no row so a retry can send', async () => {
  const event = otpEvent();
  const failing: SmsProvider = { send: () => Promise.reject(new Error('provider down')) };

  await expect(handle(event, failing)).rejects.toThrow('provider down');
  await handle(event);

  expect(sent).toHaveLength(1);
  expect(await statuses()).toEqual(['sent']);
});

function contactEvent(
  userId: string,
  name: string,
  timestamp: string,
): EventEnvelope<UserContactPayload> {
  return {
    eventId: randomUUID(),
    timestamp,
    producer: 'identity-service',
    payload: { userId, name, phone: '+919815012345', email: null },
  };
}

test('upsertRecipient, when an older event arrives after a newer one, keeps the newer details', async () => {
  const userId = randomUUID();

  await upsertRecipient(orm.em.fork(), contactEvent(userId, 'Asha K', '2026-11-03T10:00:00.000Z'));
  await upsertRecipient(orm.em.fork(), contactEvent(userId, 'Asha', '2026-11-03T09:00:00.000Z'));

  const rows = await sql<{ name: string }>(
    orm.em.fork(),
    'select name from recipients where user_id = ?',
    [userId],
  );
  expect(rows).toEqual([{ name: 'Asha K' }]);
});
