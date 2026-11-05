import { randomUUID } from 'node:crypto';
import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/es';

/**
 * A short admin-editable text shown inside a form (the sign-up data-protection notice).
 * Append-only: an edit inserts the next version, and the highest version is the current one,
 * so a user row can always point at exactly the text they accepted. Never deleted, so no
 * soft-delete filter.
 */
@Entity({ tableName: 'content_blocks' })
@Unique({ properties: ['key', 'locale', 'version'] })
export class ContentBlock {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property({ type: 'text' })
  key!: string;

  @Property({ type: 'text' })
  locale!: string;

  @Property({ type: 'integer' })
  version!: number;

  @Property({ type: 'text' })
  body!: string;

  @Property({ type: 'json' })
  links!: { label: string; url: string }[];

  @Property({ type: 'uuid', nullable: true })
  updatedBy?: string;

  @Property({ type: 'Date' })
  createdAt = new Date();
}
