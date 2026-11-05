import {
  EXCHANGES,
  ROUTING_KEYS,
  type AccountDecisionPayload,
  type OtpRequestedPayload,
  type UserContactPayload,
} from '@hanu/contracts';
import { subscribe, type Orm, type RabbitConnection } from '@hanu/service-kit';
import { handleAccountDecided } from './consumers/account-decided.js';
import { handleOtpRequested } from './consumers/otp-requested.js';
import { upsertRecipient } from './consumers/user-contact.js';
import type { SmsProvider } from './providers/sms-provider.js';

/** Consumers only: this service publishes nothing, so it has no outbox relay. */
export async function startMessaging(deps: {
  orm: Orm;
  connection: RabbitConnection;
  sms: SmsProvider;
  /** `PLATFORM_LOCALE`: which template rows to use. */
  locale: string;
  onError?: (error: unknown) => void;
}) {
  const common = {
    orm: deps.orm,
    connection: deps.connection,
    exchange: EXCHANGES.identity,
    ...(deps.onError === undefined ? {} : { onError: deps.onError }),
  };
  const subscriptions = [
    await subscribe<OtpRequestedPayload>({
      ...common,
      queue: `notification-service.${ROUTING_KEYS.otpRequested}`,
      keys: [ROUTING_KEYS.otpRequested],
      handler: async (envelope, em) => {
        await handleOtpRequested(em, deps.sms, envelope);
      },
    }),
    await subscribe<UserContactPayload>({
      ...common,
      queue: 'notification-service.user.contact',
      keys: [ROUTING_KEYS.userRegistered, ROUTING_KEYS.userContactChanged],
      handler: async (envelope, em) => {
        await upsertRecipient(em, envelope);
      },
    }),
    await subscribe<AccountDecisionPayload>({
      ...common,
      queue: 'notification-service.account.decided',
      keys: [
        ROUTING_KEYS.accountApproved,
        ROUTING_KEYS.accountRejected,
        ROUTING_KEYS.accountSuspended,
      ],
      handler: async (envelope, em) => {
        await handleAccountDecided(em, deps.sms, deps.locale, envelope);
      },
    }),
  ];
  return {
    async stop(): Promise<void> {
      for (const subscription of subscriptions) await subscription.close();
    },
  };
}
