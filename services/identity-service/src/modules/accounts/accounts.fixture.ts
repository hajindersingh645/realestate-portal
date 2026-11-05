import type { AccountStatus, AccountType } from '@hanu/contracts';
import { sql, type Em } from '@hanu/service-kit';
import { randomUUID } from 'node:crypto';

/** Test-only: an account in any state, written straight to the tables (no catalog call). */
export interface SeedAccount {
  status?: AccountStatus;
  type?: AccountType;
  displayName?: string;
  slug?: string;
  areas?: { locationId: string; cityId: string }[];
  deleted?: boolean;
  /** Seconds ago, so tests control the newest-first order. */
  ageSeconds?: number;
}

export async function seedUser(em: Em, registeredAs = 'professional'): Promise<string> {
  const id = randomUUID();
  await sql(
    em,
    `insert into users (id, registered_as, name, phone, email, created_at, updated_at)
     values (?, ?, 'Ravi', ?, ?, now(), now())`,
    [
      id,
      registeredAs,
      `+9198${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
      registeredAs === 'staff' ? `${id}@staff.test` : null,
    ],
  );
  return id;
}

export async function seedAccount(
  em: Em,
  seed: SeedAccount = {},
): Promise<{ accountId: string; ownerId: string; slug: string }> {
  const ownerId = await seedUser(em);
  const accountId = randomUUID();
  const slug = seed.slug ?? `pro-${accountId.slice(0, 8)}`;
  await sql(
    em,
    `insert into accounts (id, type, display_name, slug, about, experience_years, specialisations,
                           license_number, status, created_at, updated_at, deleted_at)
     values (?, ?, ?, ?, 'About', 5, '{Plots}', 'RERA-1', ?,
             now() - make_interval(secs => ?), now(), ${seed.deleted === true ? 'now()' : 'null'})`,
    [
      accountId,
      seed.type ?? 'agent',
      seed.displayName ?? 'Ravi Realty',
      slug,
      seed.status ?? 'pending',
      seed.ageSeconds ?? 0,
    ],
  );
  await sql(
    em,
    `insert into account_members (id, account_id, user_id, member_role, status, joined_at)
     values (?, ?, ?, 'owner', 'active', now())`,
    [randomUUID(), accountId, ownerId],
  );
  for (const area of seed.areas ?? []) {
    await sql(
      em,
      'insert into account_locations (account_id, location_id, city_id) values (?, ?, ?)',
      [accountId, area.locationId, area.cityId],
    );
  }
  return { accountId, ownerId, slug };
}
