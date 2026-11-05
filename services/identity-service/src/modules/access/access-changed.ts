import { EXCHANGES, ROUTING_KEYS, type UserAccessChangedPayload } from '@hanu/contracts';
import { AppError, outboxAdd, type Em } from '@hanu/service-kit';

export class SelfChangeError extends AppError {
  constructor() {
    super('SELF_CHANGE', 'You cannot change your own access or status', 409);
  }
}

/** Refuses a change an admin makes to themself, so the last admin cannot lock themself out. */
export function refuseSelf(actorUserId: string | null, targetUserId: string): void {
  if (actorUserId === targetUserId) throw new SelfChangeError();
}

/**
 * Queues `user.access.changed` for each user, in the caller's transaction. The gateway then
 * refuses their access tokens issued before now, so the change applies within seconds.
 */
export async function accessChanged(
  em: Em,
  producer: string,
  userIds: readonly string[],
): Promise<void> {
  const changedAt = new Date().toISOString();
  for (const userId of new Set(userIds)) {
    const payload: UserAccessChangedPayload = { userId, changedAt };
    await outboxAdd(em, {
      exchange: EXCHANGES.identity,
      routingKey: ROUTING_KEYS.userAccessChanged,
      producer,
      payload,
    });
  }
}
