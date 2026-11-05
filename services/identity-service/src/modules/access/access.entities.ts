import { randomUUID } from 'node:crypto';
import { PrimaryKeyProp } from '@mikro-orm/core';
import { Entity, Filter, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/es';

/** A named set of permissions. System roles are seeded; staff roles are created by admins. */
@Entity({ tableName: 'roles' })
@Filter({ name: 'softDelete', cond: { deletedAt: null }, default: true })
export class Role {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  /** Used in code (`super_admin`); unique across deleted rows too, so it is never reused. */
  @Unique()
  @Property({ type: 'text' })
  key!: string;

  @Property({ type: 'text' })
  name!: string;

  @Property({ type: 'boolean' })
  isSystem = false;

  @Property({ type: 'Date' })
  createdAt = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt = new Date();

  @Property({ type: 'Date', nullable: true })
  deletedAt?: Date;
}

/** Every key in `PERMISSIONS` (contracts). Synced on each `pnpm migrate`. */
@Entity({ tableName: 'permissions' })
export class Permission {
  @PrimaryKey({ type: 'text' })
  key!: string;
}

/** Link rows below are deleted outright when revoked; the audit log keeps the history. */
@Entity({ tableName: 'role_permissions' })
export class RolePermission {
  [PrimaryKeyProp]?: ['roleId', 'permissionKey'];

  @PrimaryKey({ type: 'uuid' })
  roleId!: string;

  @PrimaryKey({ type: 'text' })
  permissionKey!: string;
}

@Entity({ tableName: 'user_roles' })
export class UserRole {
  [PrimaryKeyProp]?: ['userId', 'roleId'];

  @PrimaryKey({ type: 'uuid' })
  userId!: string;

  @PrimaryKey({ type: 'uuid' })
  roleId!: string;

  @Property({ type: 'uuid', nullable: true })
  grantedBy?: string;

  @Property({ type: 'Date' })
  grantedAt = new Date();
}

/** Per-user exception to their roles: `allow` adds a permission, `deny` removes it. */
@Entity({ tableName: 'user_permission_overrides' })
export class UserPermissionOverride {
  [PrimaryKeyProp]?: ['userId', 'permissionKey'];

  @PrimaryKey({ type: 'uuid' })
  userId!: string;

  @PrimaryKey({ type: 'text' })
  permissionKey!: string;

  /** allow | deny */
  @Property({ type: 'text' })
  effect!: string;

  @Property({ type: 'text' })
  reason!: string;

  @Property({ type: 'uuid', nullable: true })
  createdBy?: string;

  @Property({ type: 'Date' })
  createdAt = new Date();
}
