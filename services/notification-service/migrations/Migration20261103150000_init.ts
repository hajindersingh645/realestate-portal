import { INFRA_STATEMENTS } from '@hanu/service-kit';
import { Migration } from '@mikro-orm/migrations';

export class Migration20261103150000_init extends Migration {
  override up(): void {
    for (const statement of INFRA_STATEMENTS) this.addSql(statement);
  }
}
