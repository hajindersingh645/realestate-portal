import { appendOnlySql, GRANT_RUNTIME_SQL } from '@hanu/service-kit';
import { Migration } from '@mikro-orm/migrations';

/**
 * Written by hand: grants are not part of the entity snapshot. Gives the runtime role access
 * to the tables created before it existed, then makes the shared history tables append-only.
 */
export class Migration20261103160000_runtime_role extends Migration {
  override up(): void {
    this.addSql(GRANT_RUNTIME_SQL);
    this.addSql(appendOnlySql(['settings', 'state_transitions']));
  }
}
