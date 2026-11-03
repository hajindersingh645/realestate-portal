import { PERMISSIONS } from '@hanu/contracts';
import { ApiError } from '../../api/errors';
import { FormDialog } from '../../ui/FormDialog';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';
import { textOf } from '../../ui/form-values';
import { ACCESS_ERRORS, useIdentityWrite } from '../access-api';
import { FormError } from '../../ui/FormError';

export interface OverrideDialogProps {
  userId: string;
  onClose: () => void;
}

/** Allows or denies one permission for one user, on top of their roles, with a reason. */
export function OverrideDialog({ userId, onClose }: OverrideDialogProps) {
  const write = useIdentityWrite('Override saved');
  const fields = write.error instanceof ApiError ? write.error.fields : {};

  function submit(form: FormData) {
    write.mutate(
      {
        path: `/users/${userId}/overrides/${textOf(form, 'permission')}`,
        method: 'PUT',
        body: { effect: textOf(form, 'effect'), reason: textOf(form, 'reason').trim() },
      },
      { onSuccess: onClose },
    );
  }

  return (
    <FormDialog
      open
      title="Add override"
      onClose={onClose}
      onSubmit={submit}
      pending={write.isPending}
      error={null}
    >
      <FormError
        error={Object.keys(fields).length > 0 ? null : write.error}
        messages={ACCESS_ERRORS}
      />
      <Select
        label="Permission"
        name="permission"
        options={PERMISSIONS.map((p) => ({ value: p, label: p }))}
      />
      <Select
        label="Effect"
        name="effect"
        options={[
          { value: 'deny', label: 'Deny: take it away even if a role gives it' },
          { value: 'allow', label: 'Allow: give it even if no role does' },
        ]}
      />
      <TextField
        label="Reason"
        name="reason"
        required
        minLength={3}
        hint="Recorded in the audit log."
        {...(fields.reason === undefined ? {} : { error: fields.reason })}
      />
    </FormDialog>
  );
}
