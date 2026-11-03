import { randomUUID } from 'node:crypto';
import { maskPhone } from '../modules/delivery/mask.js';
import type { SmsProvider } from './sms-provider.js';

/**
 * Development only: writes the message to the log instead of sending it, so codes can be read
 * from the console. Refuses to start in production, where the log would leak them.
 */
export class ConsoleSmsProvider implements SmsProvider {
  constructor(
    nodeEnv: string,
    private readonly log: (line: string) => void,
  ) {
    if (nodeEnv === 'production') throw new Error('ConsoleSmsProvider must not run in production');
  }

  send(message: { to: string; body: string }): Promise<{ providerMessageId: string }> {
    this.log(`sms to ${maskPhone(message.to)}: ${message.body}`);
    return Promise.resolve({ providerMessageId: `console-${randomUUID()}` });
  }
}
