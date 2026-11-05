import { FormDialog, Select, TextField, textOf } from '@hanu/web-kit';
import { fieldErrors, formLevelError, useCatalogWrite } from '../catalog-api';
import type { Option, UnitConversion } from './UnitConversionsPage';

export interface UnitConversionFormProps {
  initial?: UnitConversion;
  units: Option[];
  cities: Option[];
  onClose: () => void;
}

/** Add a conversion, or change its factor. To move one to another unit or city, add a new one. */
export function UnitConversionForm({ initial, units, cities, onClose }: UnitConversionFormProps) {
  const write = useCatalogWrite(
    'unit-conversions',
    initial === undefined ? 'Conversion added' : 'Conversion saved',
  );
  const errors = fieldErrors(write.error, 'locationId');

  function submit(form: FormData) {
    const factor = Number(textOf(form, 'factor'));
    if (initial !== undefined) {
      write.mutate(
        { path: `/${initial.id}`, method: 'PATCH', body: { factor } },
        { onSuccess: onClose },
      );
      return;
    }
    const locationId = textOf(form, 'locationId');
    write.mutate(
      {
        method: 'POST',
        body: {
          unitId: textOf(form, 'unitId'),
          factor,
          ...(locationId === '' ? {} : { locationId }),
        },
      },
      { onSuccess: onClose },
    );
  }

  return (
    <FormDialog
      open
      title={initial === undefined ? 'Add conversion' : 'Edit conversion'}
      onClose={onClose}
      onSubmit={submit}
      pending={write.isPending}
      error={formLevelError(write.error)}
    >
      {initial === undefined && (
        <>
          <Select
            label="Unit"
            name="unitId"
            placeholder="Choose…"
            options={units}
            required
            {...(errors.unitId === undefined ? {} : { error: errors.unitId })}
          />
          <Select
            label="City"
            name="locationId"
            placeholder="Every city (default)"
            options={cities}
            {...(errors.locationId === undefined ? {} : { error: errors.locationId })}
          />
        </>
      )}
      <TextField
        label="Factor"
        name="factor"
        type="number"
        step="any"
        min="0"
        inputMode="decimal"
        defaultValue={initial?.factor}
        hint="How many base units (e.g. square feet) make one of this unit."
        required
        {...(errors.factor === undefined ? {} : { error: errors.factor })}
      />
    </FormDialog>
  );
}
