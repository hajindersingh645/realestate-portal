import { Migration } from '@mikro-orm/migrations';

export class Migration20261103123301_add_property_types extends Migration {
  override name = 'Migration20261103123301_add_property_types';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "property_types" ("id" uuid not null, "parent_id" uuid null, "slug" text not null, "name" text not null, "kind" text not null, "is_active" boolean not null default true, "sort" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`,
    );
    this.addSql(`create index "property_types_parent_id_index" on "property_types" ("parent_id");`);
    this.addSql(
      `alter table "property_types" add constraint "property_types_slug_unique" unique ("slug");`,
    );
    // Hand-added: what the entity cannot express.
    this.addSql(
      `alter table "property_types" add constraint "property_types_kind_check" check ("kind" in ('flat', 'house', 'plot', 'commercial'));`,
    );
    this.addSql(
      `alter table "property_types" add constraint "property_types_parent_fk" foreign key ("parent_id") references "property_types" ("id") on delete restrict;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "property_types" cascade;`);
  }
}
