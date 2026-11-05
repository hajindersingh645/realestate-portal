import { sql, uuidv7, type Em } from '@hanu/service-kit';
import { maskPhone } from '../modules/delivery/mask.js';
import { render } from '../modules/templates/render.js';
import type { SmsProvider } from '../providers/sms-provider.js';

/**
 * Texts a user about a staff decision once per event, with template `code` and an optional
 * `{{reason}}`. The phone comes from the local `recipients` copy. Not copied yet → throw, and the
 * broker retries (then dead-letters). Erased → recorded as skipped, nothing sent.
 */
export async function sendDecisionSms(
  em: Em,
  sms: SmsProvider,
  locale: string,
  eventId: string,
  userId: string,
  code: string,
  reason: string | null,
): Promise<void> {
  const recipients = await sql<{ phone: string; erased: boolean }>(
    em,
    'select phone, erased_at is not null as erased from recipients where user_id = ?',
    [userId],
  );
  const recipient = recipients[0];
  if (recipient === undefined) throw new Error(`No recipient ${userId} yet`);

  const inserted = await sql<{ id: string }>(
    em,
    `insert into notifications (id, event_id, user_id, phone_masked, channel, template_code, status, created_at)
     values (?, ?, ?, ?, 'sms', ?, ?, now())
     on conflict (event_id, channel, template_code) do nothing
     returning id`,
    [
      uuidv7(),
      eventId,
      userId,
      maskPhone(recipient.phone),
      code,
      recipient.erased ? 'skipped_no_recipient' : 'sent',
    ],
  );
  const row = inserted[0];
  if (row === undefined || recipient.erased) return;

  const templates = await sql<{ body: string; dlt_template_id: string | null }>(
    em,
    `select body, dlt_template_id from templates
      where code = ? and channel = 'sms' and locale = ? and is_active and deleted_at is null`,
    [code, locale],
  );
  const template = templates[0];
  if (template === undefined) throw new Error(`No active SMS template '${code}' for ${locale}`);
  const values = new Map<string, string>();
  if (reason !== null) values.set('reason', reason);

  const { providerMessageId } = await sms.send({
    to: recipient.phone,
    body: render(template.body, values),
    dltTemplateId: template.dlt_template_id,
  });
  await sql(em, 'update notifications set provider_message_id = ? where id = ?', [
    providerMessageId,
    row.id,
  ]);
}
