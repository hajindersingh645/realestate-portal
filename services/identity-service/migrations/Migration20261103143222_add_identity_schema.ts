import { appendOnlySql } from '@hanu/service-kit';
import { Migration } from '@mikro-orm/migrations';

export class Migration20261103143222_add_identity_schema extends Migration {
  override name = 'Migration20261103143222_add_identity_schema';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "audit_logs" ("id" uuid not null, "event_id" uuid not null, "actor_user_id" uuid null, "service" text not null, "action" text not null, "target_type" text not null, "target_id" text not null, "diff" jsonb null, "ip" text null, "created_at" timestamptz not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "audit_logs" add constraint "audit_logs_event_id_unique" unique ("event_id");`,
    );

    this.addSql(
      `create table "otp_challenges" ("id" uuid not null, "phone" text not null, "purpose" text not null, "code_hash" text not null, "expires_at" timestamptz not null, "attempts" int not null default 0, "locked_until" timestamptz null, "consumed_at" timestamptz null, "user_id" uuid null, "created_at" timestamptz not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "otp_challenges_phone_purpose_created_at_index" on "otp_challenges" ("phone", "purpose", "created_at");`,
    );

    this.addSql(`create table "permissions" ("key" text not null, primary key ("key"));`);

    this.addSql(
      `create table "roles" ("id" uuid not null, "key" text not null, "name" text not null, "is_system" boolean not null default false, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`,
    );
    this.addSql(`alter table "roles" add constraint "roles_key_unique" unique ("key");`);

    this.addSql(
      `create table "role_permissions" ("role_id" uuid not null, "permission_key" text not null, primary key ("role_id", "permission_key"));`,
    );

    this.addSql(
      `create table "sessions" ("id" uuid not null, "user_id" uuid not null, "refresh_token_hash" text not null, "user_agent" text null, "ip" text null, "expires_at" timestamptz not null, "revoked_at" timestamptz null, "created_at" timestamptz not null, "rotated_at" timestamptz null, primary key ("id"));`,
    );

    this.addSql(
      `create table "users" ("id" uuid not null, "registered_as" text not null, "name" text not null, "phone" text not null, "phone_verified_at" timestamptz null, "email" text null, "email_verified_at" timestamptz null, "password_hash" text null, "status" text not null default 'active', "kyc_status" text not null default 'none', "notice_block_id" uuid null, "consented_at" timestamptz null, "erased_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`,
    );

    this.addSql(
      `create table "user_permission_overrides" ("user_id" uuid not null, "permission_key" text not null, "effect" text not null, "reason" text not null, "created_by" uuid null, "created_at" timestamptz not null, primary key ("user_id", "permission_key"));`,
    );

    this.addSql(
      `create table "user_roles" ("user_id" uuid not null, "role_id" uuid not null, "granted_by" uuid null, "granted_at" timestamptz not null, primary key ("user_id", "role_id"));`,
    );

    // ---- Hand-added: what the entities cannot express ----

    // Users: allowed values, staff need credentials, live phone and email are unique.
    this.addSql(`alter table users
      add constraint users_registered_as_check check (registered_as in ('buyer', 'professional', 'staff')),
      add constraint users_status_check check (status in ('active', 'suspended', 'banned')),
      add constraint users_kyc_status_check check (kyc_status in ('none', 'pending', 'verified', 'rejected')),
      add constraint users_staff_credentials_check
        check (registered_as <> 'staff' or (email is not null and password_hash is not null))`);
    this.addSql(
      `create unique index users_phone_live_unique on users (phone) where deleted_at is null`,
    );
    this.addSql(`create unique index users_email_live_unique on users (lower(email))
      where email is not null and deleted_at is null`);

    this.addSql(`alter table otp_challenges
      add constraint otp_challenges_purpose_check check (purpose in ('login', 'staff_login')),
      add constraint otp_challenges_user_fk foreign key (user_id) references users (id)`);

    this.addSql(
      `alter table sessions add constraint sessions_user_fk foreign key (user_id) references users (id)`,
    );
    this.addSql(`create index sessions_user_live on sessions (user_id) where revoked_at is null`);

    this.addSql(`alter table role_permissions
      add constraint role_permissions_role_fk foreign key (role_id) references roles (id),
      add constraint role_permissions_permission_fk foreign key (permission_key) references permissions (key)`);
    this.addSql(`alter table user_roles
      add constraint user_roles_user_fk foreign key (user_id) references users (id),
      add constraint user_roles_role_fk foreign key (role_id) references roles (id)`);
    this.addSql(`create index user_roles_role on user_roles (role_id)`);
    this.addSql(`alter table user_permission_overrides
      add constraint user_permission_overrides_user_fk foreign key (user_id) references users (id),
      add constraint user_permission_overrides_permission_fk foreign key (permission_key) references permissions (key),
      add constraint user_permission_overrides_effect_check check (effect in ('allow', 'deny')),
      add constraint user_permission_overrides_reason_check check (length(trim(reason)) > 0)`);

    this.addSql(
      `create index audit_logs_target on audit_logs (target_type, target_id, created_at desc)`,
    );
    this.addSql(`create index audit_logs_actor on audit_logs (actor_user_id, created_at desc)`);
    this.addSql(appendOnlySql(['audit_logs']));

    // Settings, version 1. Changed later by adding a version, never by update.
    this.addSql(`insert into settings (key, version, value) values
      ('otp.ttlSeconds', 1, '300'),
      ('otp.maxResends', 1, '3'),
      ('otp.maxAttempts', 1, '5'),
      ('otp.lockMinutes', 1, '30'),
      ('otp.resendWindowMinutes', 1, '30'),
      ('session.refreshDays', 1, '30'),
      ('license.mandatory', 1, 'false'),
      ('license.label', 1, '"RERA"'),
      ('kyc.mode', 1, '"off"'),
      ('account.approval', 1, '"manual"')`);

    // System roles and their starting permissions (architecture.md 6.3). The permission rows
    // themselves come from `syncPermissions` after migrating; super_admin is granted there too.
    this.addSql(`insert into roles (id, key, name, is_system, created_at, updated_at) values
      (gen_random_uuid(), 'buyer', 'Buyer', true, now(), now()),
      (gen_random_uuid(), 'agent', 'Agent', true, now(), now()),
      (gen_random_uuid(), 'consultant', 'Consultant', true, now(), now()),
      (gen_random_uuid(), 'agency_owner', 'Agency owner', true, now(), now()),
      (gen_random_uuid(), 'agency_member', 'Agency member', true, now(), now()),
      (gen_random_uuid(), 'super_admin', 'Super admin', true, now(), now())`);
    const buyer = [
      'requirement.create',
      'requirement.manage_own',
      'review.create',
      'report.create',
      'listing.enquire',
      'billing.purchase',
    ];
    const professional = [
      'lead.view_feed',
      'lead.unlock',
      'lead.manage_pipeline',
      'listing.create',
      'listing.manage_own',
      'billing.purchase',
      'profile.manage',
      'team.manage',
      'handshake.use',
    ];
    const member = professional.filter(
      (k) => !['billing.purchase', 'profile.manage', 'team.manage'].includes(k),
    );
    const grants: [string, string[]][] = [
      ['buyer', buyer],
      ['agent', professional],
      ['consultant', professional],
      ['agency_owner', professional],
      ['agency_member', member],
    ];
    const allKeys = [...new Set([...buyer, ...professional])];
    this.addSql(`insert into permissions (key) values ${allKeys.map((k) => `('${k}')`).join(', ')}
      on conflict do nothing`);
    for (const [role, keys] of grants) {
      this.addSql(`insert into role_permissions (role_id, permission_key)
        select id, unnest(array[${keys.map((k) => `'${k}'`).join(', ')}]) from roles where key = '${role}'`);
    }
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "audit_logs" cascade;`);
    this.addSql(`drop table if exists "otp_challenges" cascade;`);
    this.addSql(`drop table if exists "permissions" cascade;`);
    this.addSql(`drop table if exists "roles" cascade;`);
    this.addSql(`drop table if exists "role_permissions" cascade;`);
    this.addSql(`drop table if exists "sessions" cascade;`);
    this.addSql(`drop table if exists "users" cascade;`);
    this.addSql(`drop table if exists "user_permission_overrides" cascade;`);
    this.addSql(`drop table if exists "user_roles" cascade;`);
  }
}
