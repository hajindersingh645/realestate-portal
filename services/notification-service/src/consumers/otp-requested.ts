import type { EventEnvelope, OtpRequestedPayload } from '@hanu/contracts';
import { sql, uuidv7, type Em } from '@hanu/service-kit';
import { maskPhone } from '../modules/delivery/mask.js';
import { render } from '../modules/templates/render.js';
import type { SmsProvider } from '../providers/sms-provider.js';

/**
 * Sends the login code by SMS, once per event. A code that arrives after it expired is recorded
 * as skipped and not sent. If the provider fails, the error rolls the row back and the message
 * is retried (then dead-lettered); the code may expire meanwhile, and the user asks again.
 */
export async function handleOtpRequested(
  em: Em,
  sms: SmsProvider,
  envelope: EventEnvelope<OtpRequestedPayload>,
  now: Date = new Date(),
): Promise<void> {
  const otp = envelope.payload;
  const expired = Date.parse(otp.expiresAt) <= now.getTime();
  const inserted = await sql<{ id: string }>(
    em,
    `insert into notifications (id, event_id, phone_masked, channel, template_code, status, created_at)
     values (?, ?, ?, 'sms', 'otp', ?, now())
     on conflict (event_id, channel, template_code) do nothing
     returning id`,
    [uuidv7(), envelope.eventId, maskPhone(otp.phone), expired ? 'skipped_expired' : 'sent'],
  );
  const row = inserted[0];
  if (row === undefined || expired) return;

  const templates = await sql<{ body: string; dlt_template_id: string | null }>(
    em,
    `select body, dlt_template_id from templates
      where code = 'otp' and channel = 'sms' and locale = ? and is_active and deleted_at is null`,
    [otp.locale],
  );
  const template = templates[0];
  if (template === undefined) throw new Error(`No active SMS template 'otp' for ${otp.locale}`);
  const minutes = Math.max(
    1,
    Math.round((Date.parse(otp.expiresAt) - Date.parse(envelope.timestamp)) / 60_000),
  );
  const body = render(
    template.body,
    new Map([
      ['code', otp.code],
      ['minutes', String(minutes)],
    ]),
  );

  const { providerMessageId } = await sms.send({
    to: otp.phone,
    body,
    dltTemplateId: template.dlt_template_id,
  });
  await sql(em, 'update notifications set provider_message_id = ? where id = ?', [
    providerMessageId,
    row.id,
  ]);
}
