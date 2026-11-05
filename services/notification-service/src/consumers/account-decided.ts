import type { AccountDecisionPayload, EventEnvelope } from '@hanu/contracts';
import type { Em } from '@hanu/service-kit';
import type { SmsProvider } from '../providers/sms-provider.js';
import { sendDecisionSms } from './decision-sms.js';

/**
 * Texts the owner about a staff decision (`account.approved|rejected|suspended`), once per
 * event; the template is `account.<status>`, so a ban gets its own text.
 */
export async function handleAccountDecided(
  em: Em,
  sms: SmsProvider,
  locale: string,
  envelope: EventEnvelope<AccountDecisionPayload>,
): Promise<void> {
  const { ownerUserId, status, reason } = envelope.payload;
  await sendDecisionSms(
    em,
    sms,
    locale,
    envelope.eventId,
    ownerUserId,
    `account.${status}`,
    reason,
  );
}
