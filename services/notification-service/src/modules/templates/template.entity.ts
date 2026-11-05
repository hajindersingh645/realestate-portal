import { randomUUID } from 'node:crypto';
import { Entity, Filter, PrimaryKey, Property } from '@mikro-orm/decorators/es';

/** Message text per code, channel and locale. `{{name}}` placeholders are filled when sending. */
@Entity({ tableName: 'templates' })
@Filter({ name: 'softDelete', cond: { deletedAt: null }, default: true })
export class Template {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property({ type: 'text' })
  code!: string;

  /** sms | email */
  @Property({ type: 'text' })
  channel!: string;

  @Property({ type: 'text' })
  locale!: string;

  /** Email only. */
  @Property({ type: 'text', nullable: true })
  subject?: string;

  @Property({ type: 'text' })
  body!: string;

  /** India: the template id registered on the DLT platform; required by SMS providers. */
  @Property({ type: 'text', nullable: true })
  dltTemplateId?: string;

  @Property({ type: 'boolean' })
  isActive = true;

  @Property({ type: 'Date' })
  createdAt = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt = new Date();

  @Property({ type: 'Date', nullable: true })
  deletedAt?: Date;
}
