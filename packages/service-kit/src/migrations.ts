import type { EntityClass } from '@mikro-orm/core';
import { Migrator, TSMigrationGenerator } from '@mikro-orm/migrations';
import { defineConfig, type Options } from '@mikro-orm/postgresql';

/** Tables created by INFRA_STATEMENTS. They have no entities, so the migration generator must skip them. */
export const INFRA_TABLES: readonly string[] = [
  'outbox_events',
  'inbox_events',
  'idempotency_keys',
  'settings',
  'state_transitions',
];

/** Removes the `"schema".` prefix, so a migration runs in whatever schema DB_SCHEMA names at runtime. */
export function stripSchema(sql: string, schema: string): string {
  return sql.replaceAll(`"${schema}".`, '');
}

/** Config for the MikroORM CLI (`migration:create`). The running service uses `createOrm` instead. */
export function createCliConfig(options: {
  clientUrl: string;
  schema: string;
  entities: EntityClass<unknown>[];
}): Options {
  const { schema } = options;

  class UnqualifiedGenerator extends TSMigrationGenerator {
    override createStatement(sql: string, padLeft: number): string {
      return super.createStatement(stripSchema(sql, schema), padLeft);
    }
  }

  return defineConfig({
    clientUrl: options.clientUrl,
    schema,
    entities: options.entities,
    extensions: [Migrator],
    migrations: {
      path: './migrations',
      tableName: 'mikro_orm_migrations',
      snapshot: true,
      snapshotOnMigrate: false,
      generator: UnqualifiedGenerator,
    },
    schemaGenerator: { skipTables: [...INFRA_TABLES] },
  });
}
