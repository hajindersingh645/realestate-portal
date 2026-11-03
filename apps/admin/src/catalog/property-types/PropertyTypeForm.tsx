import { PROPERTY_KINDS } from '@hanu/contracts';
import { FormDialog } from '../../ui/FormDialog';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';
import { textOf } from '../../ui/form-values';
import { fieldErrors, formLevelError, useCatalogWrite } from '../catalog-api';
import type { PropertyType } from './PropertyTypesPage';

export interface PropertyTypeFormProps {
  initial?: PropertyType;
  /** Top-level types a new one can sit under. */
  parents: PropertyType[];
  onClose: () => void;
}

const KIND_LABELS = new Map([
  ['flat', 'Flat (apartment fields)'],
  ['house', 'House (independent house fields)'],
  ['plot', 'Plot (land fields)'],
  ['commercial', 'Commercial'],
]);

/** Add or edit a property type. Slug and kind are fixed once created. */
export function PropertyTypeForm({ initial, parents, onClose }: PropertyTypeFormProps) {
  const write = useCatalogWrite(
    'property-types',
    initial === undefined ? 'Property type added' : 'Property type saved',
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
    const parentId = textOf(form, 'parentId');
    write.mutate(
      {
        method: 'POST',
        body: {
          name: textOf(form, 'name').trim(),
          slug: textOf(form, 'slug').trim(),
          kind: textOf(form, 'kind'),
          ...(parentId === '' ? {} : { parentId }),
        },
      },
      { onSuccess: onClose },
    );
  }

  return (
    <FormDialog
      open
      title={initial === undefined ? 'Add property type' : `Edit ${initial.name}`}
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
            hint="Used in page addresses, e.g. high-rise-flat. It cannot change later."
            required
            {...(errors.slug === undefined ? {} : { error: errors.slug })}
          />
          <Select
            label="Kind"
            name="kind"
            defaultValue="flat"
            options={PROPERTY_KINDS.map((k) => ({ value: k, label: KIND_LABELS.get(k) ?? k }))}
            {...(errors.kind === undefined ? {} : { error: errors.kind })}
          />
          <Select
            label="Sits under"
            name="parentId"
            defaultValue=""
            placeholder="Nothing (top level)"
            options={parents.map((p) => ({ value: p.id, label: p.name }))}
          />
        </>
      )}
    </FormDialog>
  );
}
