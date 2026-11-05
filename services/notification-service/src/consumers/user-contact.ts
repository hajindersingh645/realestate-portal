import type { EventEnvelope, UserContactPayload } from '@hanu/contracts';
import { sql, type Em } from '@hanu/service-kit';

/**
 * Keeps the local copy of a user's contact details (`user.registered`, `user.contact.changed`).
 * Last write wins by event time, so an older event delivered late cannot overwrite a newer one.
 */
export async function upsertRecipient(
  em: Em,
  envelope: EventEnvelope<UserContactPayload>,
): Promise<void> {
  const user = envelope.payload;
  await sql(
    em,
    `insert into recipients (user_id, name, phone, email, updated_at) values (?, ?, ?, ?, ?)
     on conflict (user_id) do update
       set name = excluded.name, phone = excluded.phone, email = excluded.email, updated_at = excluded.updated_at
       where recipients.updated_at < excluded.updated_at and recipients.erased_at is null`,
    [user.userId, user.name, user.phone, user.email, envelope.timestamp],
  );
}
