import { Migration } from '@mikro-orm/migrations';

export class Migration20261103123443_add_locations extends Migration {
  override name = 'Migration20261103123443_add_locations';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "locations" ("id" uuid not null, "type" text not null, "parent_id" uuid null, "parent_type" text null, "name" text not null, "slug" text not null, "code" text null, "lat" double precision null, "lng" double precision null, "is_active" boolean not null default true, "sort" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`,
    );
    this.addSql(`create index "locations_parent_id_index" on "locations" ("parent_id");`);
    // Hand-added: what the entity cannot express.
    this.addSql(
      `alter table "locations" add constraint "locations_type_check" check ("type" in ('state', 'city', 'locality'));`,
    );
    // (id, type) must be unique so the composite foreign key below can point at it.
    this.addSql(
      `alter table "locations" add constraint "locations_id_type_unique" unique ("id", "type");`,
    );
    // A row's parent must exist AND be of the type the row says it is.
    this.addSql(
      `alter table "locations" add constraint "locations_parent_fk" foreign key ("parent_id", "parent_type") references "locations" ("id", "type") on delete restrict;`,
    );
    // A state has no parent, a city sits under a state, a locality under a city.
    this.addSql(
      `alter table "locations" add constraint "locations_hierarchy_check" check (
         ("type" = 'state' and "parent_id" is null and "parent_type" is null)
         or ("type" = 'city' and "parent_id" is not null and "parent_type" = 'state')
         or ("type" = 'locality' and "parent_id" is not null and "parent_type" = 'city')
       );`,
    );
    this.addSql(
      `alter table "locations" add constraint "locations_code_check" check ("code" is null or "type" = 'state');`,
    );
    this.addSql(
      `alter table "locations" add constraint "locations_coordinates_check" check (
         ("lat" is null or ("lat" between -90 and 90)) and ("lng" is null or ("lng" between -180 and 180))
       );`,
    );
    // One slug per parent; two states cannot share a slug either (nulls not distinct).
    // Deleted rows count too, so a slug that was in a URL is never handed to another place.
    this.addSql(
      `create unique index "locations_parent_slug_unique" on "locations" ("parent_id", "slug") nulls not distinct;`,
    );
    // City slugs are unique across all states, because /flats-in-<city> has no state in it.
    this.addSql(
      `create unique index "locations_city_slug_unique" on "locations" ("slug") where "type" = 'city';`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "locations" cascade;`);
  }
}
