import { appendOnlySql } from '@hanu/service-kit';
import { Migration } from '@mikro-orm/migrations';

export class Migration20261105070709_professional_accounts extends Migration {
  override name = 'Migration20261105070709_professional_accounts';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "accounts" ("id" uuid not null, "type" text not null, "display_name" text not null, "slug" text not null, "about" text null, "experience_years" int null, "specialisations" text[] not null, "license_number" text null, "status" text not null default 'pending', "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`,
    );
    this.addSql(`alter table "accounts" add constraint "accounts_slug_unique" unique ("slug");`);

    this.addSql(
      `create table "account_locations" ("account_id" uuid not null, "location_id" uuid not null, "city_id" uuid not null, primary key ("account_id", "location_id"));`,
    );

    this.addSql(
      `create table "account_members" ("id" uuid not null, "account_id" uuid not null, "user_id" uuid not null, "member_role" text not null, "status" text not null default 'active', "joined_at" timestamptz not null, "removed_at" timestamptz null, primary key ("id"));`,
    );

    this.addSql(
      `create table "account_transitions" ("id" uuid not null, "account_id" uuid not null, "from_status" text null, "to_status" text not null, "reason" text null, "actor_user_id" uuid null, "created_at" timestamptz not null, primary key ("id"));`,
    );

    // Hand-added: allowed values, links, one-account-per-user rules and append-only history.
    this.addSql(`alter table "accounts"
      add constraint "accounts_type_check" check ("type" in ('agent', 'consultant', 'agency')),
      add constraint "accounts_status_check" check ("status" in ('pending', 'approved', 'rejected', 'suspended', 'banned')),
      add constraint "accounts_experience_check" check ("experience_years" between 0 and 70);`);
    this.addSql(`alter table "account_members"
      add constraint "account_members_role_check" check ("member_role" in ('owner', 'member')),
      add constraint "account_members_status_check" check ("status" in ('active', 'removed')),
      add constraint "account_members_account_fk" foreign key ("account_id") references "accounts" ("id"),
      add constraint "account_members_user_fk" foreign key ("user_id") references "users" ("id");`);
    this.addSql(
      `create unique index "account_members_one_active_per_user" on "account_members" ("user_id") where "status" = 'active';`,
    );
    this.addSql(
      `create unique index "account_members_one_owner" on "account_members" ("account_id") where "member_role" = 'owner' and "status" = 'active';`,
    );
    this.addSql(
      `alter table "account_locations" add constraint "account_locations_account_fk" foreign key ("account_id") references "accounts" ("id");`,
    );
    this.addSql(
      `create index "account_locations_city" on "account_locations" ("city_id", "account_id");`,
    );
    this.addSql(`alter table "account_transitions"
      add constraint "account_transitions_account_fk" foreign key ("account_id") references "accounts" ("id");`);
    this.addSql(
      `create index "account_transitions_account" on "account_transitions" ("account_id", "created_at");`,
    );
    this.addSql(appendOnlySql(['account_transitions']));
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "accounts" cascade;`);
    this.addSql(`drop table if exists "account_locations" cascade;`);
    this.addSql(`drop table if exists "account_members" cascade;`);
    this.addSql(`drop table if exists "account_transitions" cascade;`);
  }
}
