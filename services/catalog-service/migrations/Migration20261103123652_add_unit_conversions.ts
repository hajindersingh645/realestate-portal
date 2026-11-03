import { Migration } from '@mikro-orm/migrations';

export class Migration20261103123652_add_unit_conversions extends Migration {
  override name = 'Migration20261103123652_add_unit_conversions';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "unit_conversions" ("id" uuid not null, "unit_id" uuid not null, "location_id" uuid null, "factor" double precision not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`,
    );
    this.addSql(`create index "unit_conversions_unit_id_index" on "unit_conversions" ("unit_id");`);
    this.addSql(
      `create index "unit_conversions_location_id_index" on "unit_conversions" ("location_id");`,
    );
    // Hand-added: what the entity cannot express.
    this.addSql(
      `alter table "unit_conversions" add constraint "unit_conversions_factor_check" check ("factor" > 0);`,
    );
    this.addSql(
      `alter table "unit_conversions" add constraint "unit_conversions_unit_fk" foreign key ("unit_id") references "lookups" ("id") on delete restrict;`,
    );
    this.addSql(
      `alter table "unit_conversions" add constraint "unit_conversions_location_fk" foreign key ("location_id") references "locations" ("id") on delete restrict;`,
    );
    // One live default per unit and one live row per unit and city (nulls not distinct makes the
    // default unique too). Deleted rows are left out, so a removed override can be added again.
    this.addSql(
      `create unique index "unit_conversions_unit_location_unique" on "unit_conversions" ("unit_id", "location_id") nulls not distinct where "deleted_at" is null;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "unit_conversions" cascade;`);
  }
}
