import type { EntityClass } from '@mikro-orm/core';
import { Migrator } from '@mikro-orm/migrations';
import { defineConfig, MikroORM, type EntityManager } from '@mikro-orm/postgresql';

export type Orm = MikroORM;
export type Em = EntityManager;

export interface OrmOptions {
  clientUrl: string;
  schema: string;
  entities: EntityClass<unknown>[];
  migrationsPath?: string;
}

export async function createOrm(options: OrmOptions): Promise<Orm> {
  return await MikroORM.init(
    defineConfig({
      clientUrl: options.clientUrl,
      schema: options.schema,
      entities: options.entities,
      extensions: [Migrator],
      migrations: {
        path: options.migrationsPath,
        tableName: 'mikro_orm_migrations',
        transactional: true,
      },
    }),
  );
}

/** Raw SQL with `?` placeholders, executed in `em`'s current transaction if it has one. */
export async function sql<T = Record<string, unknown>>(
  em: Em,
  query: string,
  params: unknown[] = [],
): Promise<T[]> {
  const rows: unknown = await em
    .getConnection()
    .execute(query, params, 'all', em.getTransactionContext());
  return rows as T[];
}

/** Tables every service owns. Each service's first migration runs these. */
export const INFRA_STATEMENTS: readonly string[] = [
  `create table if not exists outbox_events (
     id uuid primary key,
     exchange text not null,
     routing_key text not null,
     envelope jsonb not null,
     created_at timestamptz not null default now(),
     sent_at timestamptz
   )`,
  `create index if not exists outbox_events_unsent on outbox_events (created_at) where sent_at is null`,
  `create table if not exists inbox_events (
     event_id uuid not null,
     consumer text not null,
     received_at timestamptz not null default now(),
     primary key (event_id, consumer)
   )`,
  `create table if not exists idempotency_keys (
     scope text not null,
     key text not null,
     request_hash text not null,
     status text not null check (status in ('in_progress', 'done')),
     response jsonb,
     created_at timestamptz not null default now(),
     primary key (scope, key)
   )`,
  `create table if not exists settings (
     key text not null,
     version integer not null,
     value jsonb not null,
     changed_by uuid,
     changed_at timestamptz not null default now(),
     primary key (key, version)
   )`,
  `create table if not exists state_transitions (
     id uuid primary key,
     entity_type text not null,
     entity_id uuid not null,
     from_state text,
     to_state text not null,
     actor_user_id uuid,
     reason text,
     created_at timestamptz not null default now()
   )`,
  `create index if not exists state_transitions_entity
     on state_transitions (entity_type, entity_id, created_at)`,
];
