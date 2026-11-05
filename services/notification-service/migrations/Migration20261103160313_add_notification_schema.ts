import { Migration } from '@mikro-orm/migrations';

export class Migration20261103160313_add_notification_schema extends Migration {
  override name = 'Migration20261103160313_add_notification_schema';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "notifications" ("id" uuid not null, "event_id" uuid not null, "user_id" uuid null, "phone_masked" text not null, "channel" text not null, "template_code" text not null, "status" text not null, "provider_message_id" text null, "created_at" timestamptz not null, primary key ("id"));`,
    );

    this.addSql(
      `create table "recipients" ("user_id" uuid not null, "name" text not null, "phone" text not null, "email" text null, "prefs" jsonb null, "erased_at" timestamptz null, "updated_at" timestamptz not null, primary key ("user_id"));`,
    );

    this.addSql(
      `create table "templates" ("id" uuid not null, "code" text not null, "channel" text not null, "locale" text not null, "subject" text null, "body" text not null, "dlt_template_id" text null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`,
    );

    // ---- Hand-added ----
    this.addSql(`alter table notifications
      add constraint notifications_channel_check check (channel in ('sms', 'email')),
      add constraint notifications_status_check check (status in ('sent', 'skipped_expired')),
      add constraint notifications_once unique (event_id, channel, template_code)`);
    this.addSql(
      `create index notifications_user on notifications (user_id, created_at desc) where user_id is not null`,
    );
    this.addSql(`alter table templates
      add constraint templates_channel_check check (channel in ('sms', 'email')),
      add constraint templates_code_channel_locale_unique unique (code, channel, locale)`);
    this
      .addSql(`insert into templates (id, code, channel, locale, body, is_active, created_at, updated_at)
      values (gen_random_uuid(), 'otp', 'sms', 'en-IN',
              'Your Hanu.property code is {{code}}. It expires in {{minutes}} minutes. Do not share it.',
              true, now(), now())`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "notifications" cascade;`);
    this.addSql(`drop table if exists "recipients" cascade;`);
    this.addSql(`drop table if exists "templates" cascade;`);
  }
}
