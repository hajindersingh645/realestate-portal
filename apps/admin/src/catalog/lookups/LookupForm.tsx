import type { LookupGroup } from '@hanu/contracts';
import { FormDialog } from '../../ui/FormDialog';
import { TextField } from '../../ui/TextField';
import { textOf } from '../../ui/form-values';
import { fieldErrors, formLevelError, useCatalogWrite } from '../catalog-api';
import { GROUP_LABELS } from './groups';
import type { Lookup } from './LookupsPage';

export interface LookupFormProps {
  group: LookupGroup;
  initial?: Lookup;
  onClose: () => void;
}

/** Add or edit one entry of a lookup list. Group and code are fixed once created. */
export function LookupForm({ group, initial, onClose }: LookupFormProps) {
  const write = useCatalogWrite('lookups', initial === undefined ? 'Entry added' : 'Entry saved');
  const errors = fieldErrors(write.error, 'code');

  function submit(form: FormData) {
    const label = textOf(form, 'label').trim();
    if (initial !== undefined) {
      write.mutate(
        { path: `/${initial.id}`, method: 'PATCH', body: { label } },
        { onSuccess: onClose },
      );
      return;
    }
    write.mutate(
      { method: 'POST', body: { group, label, code: textOf(form, 'code').trim() } },
      { onSuccess: onClose },
    );
  }

  return (
    <FormDialog
      open
      title={
        initial === undefined
          ? `Add to ${GROUP_LABELS.get(group) ?? group}`
          : `Edit ${initial.label}`
      }
      onClose={onClose}
      onSubmit={submit}
      pending={write.isPending}
      error={formLevelError(write.error)}
    >
      <TextField
        label="Label"
        name="label"
        defaultValue={initial?.label}
        hint="What people see, e.g. 3 BHK."
        required
        {...(errors.label === undefined ? {} : { error: errors.label })}
      />
      {initial === undefined && (
        <TextField
          label="Code"
          name="code"
          hint="Stored on records: lowercase letters, numbers and underscores, e.g. 3_bhk. It cannot change later."
          required
          {...(errors.code === undefined ? {} : { error: errors.code })}
        />
      )}
    </FormDialog>
  );
}
