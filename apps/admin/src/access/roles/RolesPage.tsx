import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { DataList } from '../../ui/DataList';
import { EmptyState } from '../../ui/EmptyState';
import { PageHeader } from '../../ui/PageHeader';
import { RowMenu } from '../../ui/RowMenu';
import { StatusBadge } from '../../ui/StatusBadge';
import { useIdentityWrite, useRoles, type Role } from '../access-api';
import { RoleDialog } from './RoleDialog';

export function RolesPage() {
  const roles = useRoles();
  const [open, setOpen] = useState<Role | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const remove = useIdentityWrite('Role deleted');

  const menu = (r: Role) => (
    <RowMenu
      label={`Actions for ${r.name}`}
      items={[
        {
          label: r.isSystem ? 'View' : 'Edit',
          onSelect: () => {
            setOpen(r);
          },
        },
        ...(r.isSystem
          ? []
          : [
              {
                label: 'Delete',
                danger: true,
                onSelect: () => {
                  setDeleting(r);
                },
              },
            ]),
      ]}
    />
  );
  const kind = (r: Role) =>
    r.isSystem ? (
      <StatusBadge tone="neutral">Built-in</StatusBadge>
    ) : (
      <StatusBadge tone="success">Custom</StatusBadge>
    );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Roles"
        {...(roles.data === undefined ? {} : { count: roles.data.length })}
        actions={
          <Button
            onClick={() => {
              setOpen('new');
            }}
          >
            <Plus aria-hidden="true" className="size-4" /> New role
          </Button>
        }
      />
      <DataList
        caption="Roles"
        rows={roles.data}
        rowKey={(r) => r.id}
        loading={roles.isPending}
        error={roles.error}
        onRetry={() => void roles.refetch()}
        empty={<EmptyState title="No roles" />}
        columns={[
          { header: 'Name', cell: (r) => <span className="font-medium">{r.name}</span> },
          {
            header: 'Key',
            cell: (r) => <span className="font-mono text-xs text-zinc-500">{r.key}</span>,
          },
          { header: 'Permissions', className: 'tabular-nums', cell: (r) => r.permissions.length },
          { header: 'Type', cell: kind },
          { header: 'Actions', className: 'w-12 text-right', cell: menu },
        ]}
        card={(r) => (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{r.name}</p>
              <p className="text-xs text-zinc-500">{r.permissions.length} permissions</p>
            </div>
            <div className="flex items-center gap-2">
              {kind(r)}
              {menu(r)}
            </div>
          </div>
        )}
      />
      {open !== null && (
        <RoleDialog
          {...(open === 'new' ? {} : { role: open })}
          onClose={() => {
            setOpen(null);
          }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? ''}?`}
        message="Everyone with this role loses its permissions straight away."
        confirmLabel="Delete"
        danger
        pending={remove.isPending}
        error={remove.error}
        onClose={() => {
          setDeleting(null);
          remove.reset();
        }}
        onConfirm={() => {
          if (deleting !== null) {
            remove.mutate(
              { path: `/roles/${deleting.id}`, method: 'DELETE' },
              {
                onSuccess: () => {
                  setDeleting(null);
                },
              },
            );
          }
        }}
      />
    </div>
  );
}
