import { INFRA_STATEMENTS } from '@hanu/service-kit';
import { Migration } from '@mikro-orm/migrations';

export class Migration20261009000000_init extends Migration {
  override up(): void {
    for (const statement of INFRA_STATEMENTS) this.addSql(statement);
    this.addSql(`create table demo_pings (
      id uuid primary key,
      note text not null,
      received_at timestamptz,
      created_at timestamptz not null,
      deleted_at timestamptz
    )`);
  }

  override down(): void {
    this.addSql('drop table demo_pings');
  }
}
