import { PERMISSIONS } from '@hanu/contracts';
import { useState } from 'react';
import { ApiError, Button, Dialog, FormDialog, TextField, textOf } from '@hanu/web-kit';
import { useIdentityWrite, type Role } from '../access-api';

export interface RoleDialogProps {
  /** Absent when creating a role. */
  role?: Role;
  onClose: () => void;
}

/** Permissions grouped by their first segment: admin, lead, listing… */
const GROUPS = [...new Set(PERMISSIONS.map((p) => p.split('.')[0] ?? p))].map((group) => ({
  group,
  keys: PERMISSIONS.filter((p) => p.startsWith(`${group}.`)),
}));

interface ChecklistProps {
  chosen: Set<string>;
  readOnly: boolean;
  onToggle: (key: string) => void;
}

function Checklist({ chosen, readOnly, onToggle }: ChecklistProps) {
  return (
    <div className="flex flex-col gap-4">
      {GROUPS.map((g) => (
        <fieldset key={g.group}>
          <legend className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            {g.group}
          </legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {g.keys.map((key) => (
              <label
                key={key}
                className="flex items-center gap-2 rounded-md px-1.5 py-1 font-mono text-xs hover:bg-zinc-50"
              >
                <input
                  type="checkbox"
                  className="accent-accent"
                  checked={chosen.has(key)}
                  disabled={readOnly}
                  onChange={() => {
                    onToggle(key);
                  }}
                />
                {key}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

/** Create, edit or (for system roles) view a role and its permission set. */
export function RoleDialog({ role, onClose }: RoleDialogProps) {
  const [chosen, setChosen] = useState(() => new Set(role?.permissions ?? []));
  const write = useIdentityWrite(role === undefined ? 'Role created' : 'Role saved');
  const fields = write.error instanceof ApiError ? write.error.fields : {};

  function toggle(key: string) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (role?.isSystem === true) {
    return (
      <Dialog
        open
        title={role.name}
        onClose={onClose}
        footer={<Button onClick={onClose}>Close</Button>}
      >
        <p className="mb-4 text-sm text-zinc-600">
          A built-in role. Its permissions are set by the platform and cannot be edited here.
        </p>
        <Checklist chosen={chosen} readOnly onToggle={toggle} />
      </Dialog>
    );
  }

  function submit(form: FormData) {
    const permissions = [...chosen].sort();
    const name = textOf(form, 'name').trim();
    if (role !== undefined) {
      write.mutate(
        { path: `/roles/${role.id}`, method: 'PATCH', body: { name, permissions } },
        { onSuccess: onClose },
      );
      return;
    }
    write.mutate(
      {
        path: '/roles',
        method: 'POST',
        body: { key: textOf(form, 'key').trim(), name, permissions },
      },
      { onSuccess: onClose },
    );
  }

  return (
    <FormDialog
      open
      title={role === undefined ? 'New role' : `Edit ${role.name}`}
      onClose={onClose}
      onSubmit={submit}
      pending={write.isPending}
      error={Object.keys(fields).length > 0 ? null : write.error}
    >
      <TextField
        label="Name"
        name="name"
        defaultValue={role?.name}
        required
        {...(fields.name === undefined ? {} : { error: fields.name })}
      />
      {role === undefined && (
        <TextField
          label="Key"
          name="key"
          required
          hint="Lowercase letters, numbers and underscores, e.g. catalog_editor. It cannot change later."
          {...(fields.key === undefined ? {} : { error: fields.key })}
        />
      )}
      <Checklist chosen={chosen} readOnly={false} onToggle={toggle} />
    </FormDialog>
  );
}
