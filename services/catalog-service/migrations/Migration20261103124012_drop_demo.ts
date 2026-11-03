import { Migration } from '@mikro-orm/migrations';

export class Migration20261103124012_drop_demo extends Migration {
  override name = 'Migration20261103124012_drop_demo';

  override up(): void | Promise<void> {
    this.addSql(`drop table if exists "demo_pings" cascade;`);
  }

  override down(): void | Promise<void> {
    this.addSql(
      `create table "demo_pings" ("created_at" timestamptz(6) not null, "deleted_at" timestamptz(6) null, "id" uuid not null, "note" text not null, "received_at" timestamptz(6) null, primary key ("id"));`,
    );
  }
}
