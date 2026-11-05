import { EXCHANGES, ROUTING_KEYS, type UserContactPayload } from '@hanu/contracts';
import { NotFoundError, outboxAdd, sql, withDbErrors, type Em } from '@hanu/service-kit';
import { effectivePermissions } from '../access/index.js';
import type { UserView } from '../sessions/index.js';

export interface Me extends UserView {
  registeredAs: string;
  permissions: string[];
}

export async function getMe(em: Em, userId: string): Promise<Me> {
  const rows = await sql<UserView & { registeredAs: string }>(
    em,
    `select id, name, phone, email, registered_as as "registeredAs"
       from users where id = ? and deleted_at is null`,
    [userId],
  );
  const user = rows[0];
  if (user === undefined) throw new NotFoundError('User not found');
  return { ...user, permissions: await effectivePermissions(em, userId) };
}

/** Updates the caller's own name or email and tells other services (`user.contact.changed`). */
export async function updateMe(
  em: Em,
  producer: string,
  userId: string,
  input: { name?: string; email?: string },
): Promise<Me> {
  await em.transactional(async (tx) => {
    const rows = await withDbErrors(
      () =>
        sql<UserView>(
          tx,
          `update users set name = coalesce(?, name), email = coalesce(?, email), updated_at = now()
            where id = ? and deleted_at is null
           returning id, name, phone, email`,
          [input.name?.trim() ?? null, input.email?.trim() ?? null, userId],
        ),
      { unique: 'This email is already in use' },
    );
    const user = rows[0];
    if (user === undefined) throw new NotFoundError('User not found');
    const payload: UserContactPayload = {
      userId,
      name: user.name,
      phone: user.phone,
      email: user.email,
    };
    await outboxAdd(tx, {
      exchange: EXCHANGES.identity,
      routingKey: ROUTING_KEYS.userContactChanged,
      producer,
      payload,
    });
  });
  return await getMe(em, userId);
}

export interface ServiceUserView {
  id: string;
  name: string;
  phone: string;
  registeredAs: string;
  status: string;
}

/** For other services (lead keeps a buyer's contact): never reached through the gateway. */
export async function getUserForService(em: Em, userId: string): Promise<ServiceUserView> {
  const rows = await sql<ServiceUserView>(
    em,
    `select id, name, phone, registered_as as "registeredAs", status
       from users where id = ? and deleted_at is null`,
    [userId],
  );
  const row = rows[0];
  if (row === undefined) throw new NotFoundError('User not found');
  return row;
}
