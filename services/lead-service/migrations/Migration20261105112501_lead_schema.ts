import { Migration } from '@mikro-orm/migrations';

export class Migration20261105112501_lead_schema extends Migration {
  override name = 'Migration20261105112501_lead_schema';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "buyer_contacts" ("buyer_id" uuid not null, "name" text not null, "phone" text not null, "updated_at" timestamptz not null, primary key ("buyer_id"));`,
    );

    this.addSql(
      `create table "lead_unlocks" ("id" uuid not null, "requirement_id" uuid not null, "account_id" uuid not null, "user_id" uuid not null, "status" text not null default 'active', "charge_source" text not null, "unlocked_at" timestamptz not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "lead_unlocks_account_id_unlocked_at_index" on "lead_unlocks" ("account_id", "unlocked_at");`,
    );
    this.addSql(
      `alter table "lead_unlocks" add constraint "lead_unlocks_requirement_id_account_id_unique" unique ("requirement_id", "account_id");`,
    );

    this.addSql(
      `create table "requirements" ("id" uuid not null, "buyer_id" uuid not null, "status" text not null default 'draft', "purpose" text not null, "property_type_id" uuid not null, "budget_min" bigint not null, "budget_max" bigint not null, "bedrooms" integer[] not null default '{}', "area_min" numeric(12,2) null, "area_max" numeric(12,2) null, "area_unit" text null, "possession" text null, "timeline" text null, "loan_needed" boolean null, "preferences" jsonb not null default '{}', "notes" text null, "unlock_count" int not null default 0, "max_unlocks" int null, "fee_type" text null, "consented_at" timestamptz null, "submitted_at" timestamptz null, "published_at" timestamptz null, "expires_at" timestamptz null, "closed_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`,
    );
    this.addSql(
      `create index "requirements_buyer_id_created_at_index" on "requirements" ("buyer_id", "created_at");`,
    );
    this.addSql(
      `create index "requirements_status_published_at_id_index" on "requirements" ("status", "published_at", "id");`,
    );

    this.addSql(
      `create table "requirement_locations" ("requirement_id" uuid not null, "location_id" uuid not null, "city_id" uuid not null, primary key ("requirement_id", "location_id"));`,
    );
    this.addSql(
      `create index "requirement_locations_location_id_index" on "requirement_locations" ("location_id");`,
    );
    this.addSql(
      `create index "requirement_locations_city_id_index" on "requirement_locations" ("city_id");`,
    );

    // Hand-added: rules an entity cannot express (design phase 3, §3A).
    this.addSql(`alter table "requirements"
      add constraint "requirements_status_check" check ("status" in
        ('draft', 'pending_review', 'rejected', 'pending_payment', 'live', 'expired', 'closed', 'hidden', 'fake')),
      add constraint "requirements_purpose_check" check ("purpose" in ('buy', 'rent')),
      add constraint "requirements_fee_type_check" check ("fee_type" in ('free', 'paid')),
      add constraint "requirements_budget_check" check ("budget_min" >= 0 and "budget_min" <= "budget_max"),
      add constraint "requirements_area_check" check ("area_min" is null or "area_max" is null or "area_min" <= "area_max"),
      add constraint "requirements_unlocks_check" check ("unlock_count" between 0 and coalesce("max_unlocks", 0)),
      add constraint "requirements_live_check" check ("status" <> 'live' or ("published_at" is not null and "expires_at" is not null and "max_unlocks" is not null));`);
    this.addSql(`alter table "lead_unlocks"
      add constraint "lead_unlocks_status_check" check ("status" in ('pending', 'active', 'failed', 'refunded'));`);

    // Settings (append-only; a change is a new version). PHASE 4: delete lead.unlock.free.
    this.addSql(`insert into settings (key, version, value) values
      ('requirement.freeQuota', 1, '{"count": 1, "window": "lifetime"}'),
      ('requirement.validityDays', 1, '60'),
      ('lead.maxUnlocks', 1, '5'),
      ('lead.unlock.free', 1, 'true')`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "buyer_contacts" cascade;`);
    this.addSql(`drop table if exists "lead_unlocks" cascade;`);
    this.addSql(`drop table if exists "requirements" cascade;`);
    this.addSql(`drop table if exists "requirement_locations" cascade;`);
  }
}
