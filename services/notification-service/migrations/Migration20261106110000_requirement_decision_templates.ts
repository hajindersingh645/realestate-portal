import { Migration } from '@mikro-orm/migrations';

/** SMS texts for staff decisions on buyer requirements. */
export class Migration20261106110000_requirement_decision_templates extends Migration {
  override name = 'Migration20261106110000_requirement_decision_templates';

  override up(): void | Promise<void> {
    this
      .addSql(`insert into templates (id, code, channel, locale, body, is_active, created_at, updated_at)
      select gen_random_uuid(), t.code, 'sms', 'en-IN', t.body, true, now(), now()
        from (values
          ('requirement.live', 'Hanu.property: your requirement is approved and live. Verified property experts can now contact you.'),
          ('requirement.pending_payment', 'Hanu.property: your requirement is approved. It goes live once payment opens; we will let you know.'),
          ('requirement.rejected', 'Hanu.property: your requirement was not approved. Reason: {{reason}}. Edit it and resubmit from your dashboard.')
        ) as t(code, body)
      on conflict (code, channel, locale) do nothing`);
  }

  override down(): void | Promise<void> {
    this.addSql(`delete from templates where code like 'requirement.%'`);
  }
}
