import { Migration } from '@mikro-orm/migrations';

/** SMS texts for staff decisions on professional accounts, and a status for erased owners. */
export class Migration20261105130000_account_decision_templates extends Migration {
  override name = 'Migration20261105130000_account_decision_templates';

  override up(): void | Promise<void> {
    this.addSql(`alter table notifications drop constraint notifications_status_check,
      add constraint notifications_status_check
        check (status in ('sent', 'skipped_expired', 'skipped_no_recipient'))`);
    this
      .addSql(`insert into templates (id, code, channel, locale, body, is_active, created_at, updated_at)
      select gen_random_uuid(), t.code, 'sms', 'en-IN', t.body, true, now(), now()
        from (values
          ('account.approved', 'Hanu.property: your professional profile is approved and now visible to buyers.'),
          ('account.rejected', 'Hanu.property: your professional profile was not approved. Reason: {{reason}}. Edit it and resubmit from your dashboard.'),
          ('account.suspended', 'Hanu.property: your professional profile is suspended. Reason: {{reason}}.'),
          ('account.banned', 'Hanu.property: your professional profile has been closed. Reason: {{reason}}.')
        ) as t(code, body)
      on conflict (code, channel, locale) do nothing`);
  }

  override down(): void | Promise<void> {
    this.addSql(`delete from templates where code like 'account.%'`);
    this.addSql(`alter table notifications drop constraint notifications_status_check,
      add constraint notifications_status_check check (status in ('sent', 'skipped_expired'))`);
  }
}
