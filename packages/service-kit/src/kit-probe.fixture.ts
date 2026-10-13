import { randomUUID } from 'node:crypto';
import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/es';

/** Test-only entity used by the kit's integration tests. Not exported from the package. */
@Entity({ tableName: 'kit_probe' })
export class KitProbe {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property({ type: 'string' })
  note!: string;
}
