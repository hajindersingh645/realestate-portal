import { useState } from 'react';
import { ApiError, Button, Dialog, FormDialog, TextField, textOf } from '@hanu/web-kit';
import { useIdentityWrite, useRoles, type SetupLink } from '../access-api';
import { SetupLinkPanel } from './SetupLinkPanel';

export interface AddStaffDialogProps {
  onClose: () => void;
}

/** Adds a staff member with roles, then shows the setup link until the admin presses Done. */
export function AddStaffDialog({ onClose }: AddStaffDialogProps) {
  const roles = useRoles();
  const create = useIdentityWrite<SetupLink & { userId: string }>('Staff member added');
  const [noRole, setNoRole] = useState(false);
  const fields = create.error instanceof ApiError ? create.error.fields : {};
  // Staff roles: the ones created here, plus super admin. Member roles (buyer, agent…) are not offered.
  const staffRoles = (roles.data ?? []).filter((r) => !r.isSystem || r.key === 'super_admin');

  if (create.data !== undefined) {
    return (
      <Dialog
        open
        title="Staff member added"
        dismissible={false}
        onClose={onClose}
        footer={<Button onClick={onClose}>Done</Button>}
      >
        <SetupLinkPanel setupUrl={create.data.setupUrl} expiresAt={create.data.expiresAt} />
      </Dialog>
    );
  }

  function submit(form: FormData) {
    const roleIds = form.getAll('roleIds').filter((v): v is string => typeof v === 'string');
    setNoRole(roleIds.length === 0);
    if (roleIds.length === 0) return;
    create.mutate({
      path: '/staff',
      method: 'POST',
      body: {
        name: textOf(form, 'name').trim(),
        email: textOf(form, 'email').trim(),
        phone: textOf(form, 'phone').trim(),
        roleIds,
      },
    });
  }

  return (
    <FormDialog
      open
      title="Add staff member"
      submitLabel="Add staff member"
      onClose={onClose}
      onSubmit={submit}
      pending={create.isPending}
      error={Object.keys(fields).length > 0 ? null : create.error}
    >
      <TextField
        label="Name"
        name="name"
        required
        autoComplete="off"
        {...(fields.name === undefined ? {} : { error: fields.name })}
      />
      <TextField
        label="Work email"
        name="email"
        type="email"
        required
        autoComplete="off"
        hint="They sign in with this email."
        {...(fields.email === undefined ? {} : { error: fields.email })}
      />
      <TextField
        label="Mobile number"
        name="phone"
        type="tel"
        inputMode="tel"
        required
        autoComplete="off"
        hint="Sign-in codes are sent here."
        {...(fields.phone === undefined ? {} : { error: fields.phone })}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-zinc-700">Roles</legend>
        {staffRoles.map((r) => (
          <label
            key={r.id}
            className="flex items-start gap-2.5 rounded-lg border border-zinc-200 p-2.5 text-sm font-medium has-checked:border-accent has-checked:bg-orange-50/40"
          >
            <input type="checkbox" name="roleIds" value={r.id} className="mt-0.5 accent-accent" />
            <span className="flex flex-col">
              {r.name}
              <span className="text-xs text-zinc-500">{r.permissions.length} permissions</span>
            </span>
          </label>
        ))}
        {noRole && <p className="text-xs text-red-600">Pick at least one role.</p>}
      </fieldset>
    </FormDialog>
  );
}
