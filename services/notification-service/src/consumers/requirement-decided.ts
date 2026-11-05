import type { EventEnvelope, RequirementDecisionPayload } from '@hanu/contracts';
import type { Em } from '@hanu/service-kit';
import type { SmsProvider } from '../providers/sms-provider.js';
import { sendDecisionSms } from './decision-sms.js';

/** Texts the buyer about a staff decision on their requirement; template `requirement.<status>`. */
export async function handleRequirementDecided(
  em: Em,
  sms: SmsProvider,
  locale: string,
  envelope: EventEnvelope<RequirementDecisionPayload>,
): Promise<void> {
  const { buyerUserId, status, reason } = envelope.payload;
  await sendDecisionSms(
    em,
    sms,
    locale,
    envelope.eventId,
    buyerUserId,
    `requirement.${status}`,
    reason,
  );
}
