import type { EventEnvelope, RequirementDecisionPayload } from '@hanu/contracts';
import { sql, type Orm } from '@hanu/service-kit';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createNotificationOrm } from '../orm.js';
import type { SmsProvider } from '../providers/sms-provider.js';
import { handleRequirementDecided } from './requirement-decided.js';

const DB_URL =
  process.env.TEST_NOTIFICATION_DATABASE_URL ??
  'postgresql://svc_notification:svc_notification@localhost:5433/real_estate_test';
const PHONE = '+919815020002';

let orm: Orm;
let sent: { to: string; body: string }[];
let buyerId: string;
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
  buyerId = randomUUID();
  await sql(orm.em.fork(), 'truncate notifications, recipients');
  await sql(
    orm.em.fork(),
    `insert into recipients (user_id, name, phone, updated_at) values (?, 'Asha', ?, now())`,
    [buyerId, PHONE],
  );
});

afterAll(async () => {
  await orm.close();
});

function event(
  status: RequirementDecisionPayload['status'],
  reason: string | null = null,
): EventEnvelope<RequirementDecisionPayload> {
  return {
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    producer: 'lead-service',
    payload: { requirementId: randomUUID(), buyerUserId: buyerId, status, reason },
  };
}

async function handle(envelope: EventEnvelope<RequirementDecisionPayload>): Promise<void> {
  await orm.em.fork().transactional((em) => handleRequirementDecided(em, sms, 'en-IN', envelope));
}

test.each([
  ['live', null, 'is approved and live. Verified property experts can now contact you.'],
  ['pending_payment', null, 'is approved. It goes live once payment opens; we will let you know.'],
  [
    'rejected',
    'Remove the phone number',
    'was not approved. Reason: Remove the phone number. Edit it and resubmit from your dashboard.',
  ],
] as const)(
  'handleRequirementDecided, for %s, texts the buyer with that template',
  async (status, reason, text) => {
    await handle(event(status, reason));

    expect(sent).toEqual([
      { to: PHONE, body: `Hanu.property: your requirement ${text}`, dltTemplateId: null },
    ]);
    const rows = await sql(orm.em.fork(), 'select user_id, template_code from notifications');
    expect(rows).toEqual([{ user_id: buyerId, template_code: `requirement.${status}` }]);
  },
);

test('handleRequirementDecided, for the same event delivered twice, sends once', async () => {
  const twice = event('live');

  await handle(twice);
  await handle(twice);

  expect(sent).toHaveLength(1);
});

test('handleRequirementDecided, for a buyer not copied here yet, throws so the broker retries', async () => {
  await sql(orm.em.fork(), 'truncate recipients');

  await expect(handle(event('live'))).rejects.toThrow(/recipient/);

  expect(sent).toHaveLength(0);
});
