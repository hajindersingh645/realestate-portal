import { Migration } from '@mikro-orm/migrations';

export class Migration20261103164706_staff_setup extends Migration {
  override name = 'Migration20261103164706_staff_setup';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "staff_setup_links" ("id" uuid not null, "user_id" uuid not null, "token_hash" text not null, "expires_at" timestamptz not null, "closed_at" timestamptz null, "created_by" uuid null, "created_at" timestamptz not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "staff_setup_links" add constraint "staff_setup_links_token_hash_unique" unique ("token_hash");`,
    );
    this.addSql(
      `alter table "staff_setup_links" add constraint "staff_setup_links_user_fk" foreign key ("user_id") references "users" ("id");`,
    );
    // At most one usable link per user: issuing a new one closes the old one first.
    this.addSql(
      `create unique index "staff_setup_links_open" on "staff_setup_links" ("user_id") where "closed_at" is null;`,
    );
    this.addSql(
      `insert into settings (key, version, value) values ('staff.setupLinkTtlHours', 1, '72');`,
    );
    // Staff are created first and set their password from the setup link, so it may be empty until then.
    this.addSql(`alter table "users" drop constraint "users_staff_credentials_check";`);
    this.addSql(
      `alter table "users" add constraint "users_staff_email_check" check ("registered_as" <> 'staff' or "email" is not null);`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "staff_setup_links" cascade;`);
    this.addSql(`alter table "users" drop constraint "users_staff_email_check";`);
    this.addSql(
      `alter table "users" add constraint "users_staff_credentials_check" check ("registered_as" <> 'staff' or ("email" is not null and "password_hash" is not null));`,
    );
    this.addSql(`delete from settings where key = 'staff.setupLinkTtlHours';`);
  }
}
