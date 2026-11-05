import { Migration } from '@mikro-orm/migrations';

/** Indexes for the staff queue (by status, newest first) and the public filter by locality. */
export class Migration20261105120000_account_review_indexes extends Migration {
  override name = 'Migration20261105120000_account_review_indexes';

  override up(): void | Promise<void> {
    this.addSql(
      `create index "accounts_status_created" on "accounts" ("status", "created_at" desc, "id" desc) where "deleted_at" is null;`,
    );
    this.addSql(
      `create index "account_locations_location" on "account_locations" ("location_id", "account_id");`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop index if exists "accounts_status_created";`);
    this.addSql(`drop index if exists "account_locations_location";`);
  }
}
