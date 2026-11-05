import { appendOnlySql } from '@hanu/service-kit';
import { Migration } from '@mikro-orm/migrations';

export class Migration20261105065028_content_blocks extends Migration {
  override name = 'Migration20261105065028_content_blocks';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "content_blocks" ("id" uuid not null, "key" text not null, "locale" text not null, "version" int not null, "body" text not null, "links" jsonb not null, "updated_by" uuid null, "created_at" timestamptz not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "content_blocks" add constraint "content_blocks_key_locale_version_unique" unique ("key", "locale", "version");`,
    );
    // Hand-added: versions start at 1, and an edit is a new row (the app role may only insert).
    this.addSql(
      `alter table "content_blocks" add constraint "content_blocks_version_check" check ("version" > 0);`,
    );
    this.addSql(appendOnlySql(['content_blocks']));
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "content_blocks" cascade;`);
  }
}
