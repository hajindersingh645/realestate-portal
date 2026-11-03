import { Migration } from '@mikro-orm/migrations';

export class Migration20261103123109_add_lookups extends Migration {
  override name = 'Migration20261103123109_add_lookups';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "lookups" ("id" uuid not null, "group" text not null, "code" text not null, "label" text not null, "meta" jsonb null, "is_active" boolean not null default true, "sort" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "lookups" add constraint "lookups_group_code_unique" unique ("group", "code");`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "lookups" cascade;`);
  }
}
