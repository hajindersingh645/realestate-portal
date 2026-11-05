import type { LocationType } from '@hanu/contracts';
import { FormDialog } from '../../ui/FormDialog';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';
import { textOf } from '../../ui/form-values';
import { fieldErrors, formLevelError, useCatalogWrite } from '../catalog-api';
import { TYPE_LABELS, type Location } from './types';

export interface LocationFormProps {
  type: LocationType;
  /** The row being edited; absent when adding. */
  initial?: Location;
  parents: Location[];
  defaultParentId?: string;
  onClose: () => void;
}

/** Add or edit a location. Type, parent, slug and code are fixed once created. */
export function LocationForm({
  type,
  initial,
  parents,
  defaultParentId,
  onClose,
}: LocationFormProps) {
  const labels = TYPE_LABELS.get(type);
  const write = useCatalogWrite(
    'locations',
    initial === undefined ? 'Location added' : 'Location saved',
  );
  const errors = fieldErrors(write.error, 'slug');

  function submit(form: FormData) {
    if (initial !== undefined) {
      write.mutate(
        { path: `/${initial.id}`, method: 'PATCH', body: { name: textOf(form, 'name').trim() } },
        { onSuccess: onClose },
      );
      return;
    }
    const code = textOf(form, 'code').trim().toUpperCase();
    const parentId = textOf(form, 'parentId');
    write.mutate(
      {
        method: 'POST',
        body: {
          type,
          name: textOf(form, 'name').trim(),
          slug: textOf(form, 'slug').trim(),
          ...(code === '' ? {} : { code }),
          ...(parentId === '' ? {} : { parentId }),
        },
      },
      { onSuccess: onClose },
    );
  }

  return (
    <FormDialog
      open
      title={initial === undefined ? `Add ${labels?.one ?? 'location'}` : `Edit ${initial.name}`}
      onClose={onClose}
      onSubmit={submit}
      pending={write.isPending}
      error={formLevelError(write.error)}
    >
      <TextField
        label="Name"
        name="name"
        defaultValue={initial?.name}
        required
        {...(errors.name === undefined ? {} : { error: errors.name })}
      />
      {initial === undefined && (
        <>
          <TextField
            label="Slug"
            name="slug"
            hint="Used in page addresses: lowercase letters, numbers and dashes, e.g. sector-70. It cannot change later."
            required
            {...(errors.slug === undefined ? {} : { error: errors.slug })}
          />
          {type === 'state' && (
            <TextField
              label="Code"
              name="code"
              hint="Two or three capital letters, e.g. PB."
              maxLength={3}
              {...(errors.code === undefined ? {} : { error: errors.code })}
            />
          )}
          {labels?.parent !== null && (
            <Select
              label={labels?.parent === 'state' ? 'State' : 'City'}
              name="parentId"
              defaultValue={defaultParentId ?? ''}
              placeholder="Choose…"
              options={parents.map((p) => ({ value: p.id, label: p.name }))}
              required
              {...(errors.parentId === undefined ? {} : { error: errors.parentId })}
            />
          )}
        </>
      )}
    </FormDialog>
  );
}
