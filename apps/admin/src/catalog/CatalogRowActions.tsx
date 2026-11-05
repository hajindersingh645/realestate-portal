import { useState } from 'react';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { RowMenu, type RowMenuItem } from '../ui/RowMenu';
import { useCatalogWrite, type CatalogResource } from './catalog-api';

export interface CatalogRowActionsProps {
  resource: CatalogResource;
  id: string;
  name: string;
  /** Omit for resources that cannot be deactivated (unit conversions). */
  isActive?: boolean;
  onEdit: () => void;
}

type Pending = 'deactivate' | 'activate' | 'delete' | null;

/** ⋯ menu for a catalog row: Edit, Deactivate/Activate and Delete, each confirmed first. */
export function CatalogRowActions({
  resource,
  id,
  name,
  isActive,
  onEdit,
}: CatalogRowActionsProps) {
  const [pending, setPending] = useState<Pending>(null);
  const toggle = useCatalogWrite(
    resource,
    isActive === true ? `${name} deactivated` : `${name} activated`,
  );
  const remove = useCatalogWrite(resource, `${name} deleted`);

  const items: RowMenuItem[] = [{ label: 'Edit', onSelect: onEdit }];
  if (isActive !== undefined) {
    items.push({
      label: isActive ? 'Deactivate' : 'Activate',
      onSelect: () => {
        setPending(isActive ? 'deactivate' : 'activate');
      },
    });
  }
  items.push({
    label: 'Delete',
    danger: true,
    onSelect: () => {
      setPending('delete');
    },
  });

  function close() {
    setPending(null);
    toggle.reset();
    remove.reset();
  }

  const isDelete = pending === 'delete';
  const write = isDelete ? remove : toggle;
  return (
    <>
      <RowMenu label={`Actions for ${name}`} items={items} />
      <ConfirmDialog
        open={pending !== null}
        title={
          isDelete
            ? `Delete ${name}?`
            : pending === 'deactivate'
              ? `Deactivate ${name}?`
              : `Activate ${name}?`
        }
        message={
          isDelete
            ? 'Delete only what was added by mistake. It disappears everywhere. To retire something that is no longer offered, deactivate it instead.'
            : pending === 'deactivate'
              ? 'It stays on existing records but cannot be picked for new ones.'
              : 'It can be picked for new records again.'
        }
        confirmLabel={isDelete ? 'Delete' : pending === 'deactivate' ? 'Deactivate' : 'Activate'}
        danger={pending !== 'activate'}
        pending={write.isPending}
        error={write.error}
        onClose={close}
        onConfirm={() => {
          const call = isDelete
            ? { path: `/${id}`, method: 'DELETE' as const }
            : {
                path: `/${id}`,
                method: 'PATCH' as const,
                body: { isActive: pending === 'activate' },
              };
          write.mutate(call, { onSuccess: close });
        }}
      />
    </>
  );
}
