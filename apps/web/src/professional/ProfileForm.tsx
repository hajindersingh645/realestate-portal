import { ACCOUNT_TYPES, type AccountType } from '@hanu/contracts';
import { ApiError, Button, FormError, TextField, textOf } from '@hanu/web-kit';
import { useId, useState, type SubmitEvent } from 'react';
import type { AccountBody, MyAccount } from './account-api';
import { AreaPicker } from './AreaPicker';

export interface ProfileFormProps {
  /** Absent: the create form (type chosen once). Present: edit that account. */
  account?: MyAccount;
  error: unknown;
  pending: boolean;
  saved: boolean;
  onSubmit: (body: AccountBody) => void;
}

const TYPE_LABELS = new Map<AccountType, string>([
  ['agent', 'Agent'],
  ['consultant', 'Consultant'],
  ['agency', 'Agency'],
]);

/** The professional's public details. Empty optional fields are left out of the body. */
export function ProfileForm({ account, error, pending, saved, onSubmit }: ProfileFormProps) {
  const aboutId = useId();
  const [noAreas, setNoAreas] = useState(false);
  const fields = error instanceof ApiError ? error.fields : {};
  const slugEditable =
    account !== undefined && (account.status === 'pending' || account.status === 'rejected');
  const licenseLabel =
    account === undefined ? 'Licence number (e.g. RERA)' : `${account.license.label} number`;

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const locationIds = form.getAll('locationIds').map(String);
    if (locationIds.length === 0) {
      setNoAreas(true);
      return;
    }
    setNoAreas(false);
    const about = textOf(form, 'about').trim();
    const years = textOf(form, 'experienceYears').trim();
    const license = textOf(form, 'licenseNumber').trim();
    const specialisations = textOf(form, 'specialisations')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '');
    const editing = account !== undefined;
    onSubmit({
      ...(editing ? {} : { type: textOf(form, 'type') as AccountType }),
      displayName: textOf(form, 'displayName').trim(),
      // On edit an empty About clears it; on create it is simply left out.
      ...(editing || about !== '' ? { about } : {}),
      ...(years === '' ? {} : { experienceYears: Number(years) }),
      ...(editing || specialisations.length > 0 ? { specialisations } : {}),
      ...(license === '' ? {} : { licenseNumber: license }),
      ...(slugEditable ? { slug: textOf(form, 'slug').trim() } : {}),
      locationIds,
    });
  }

  return (
    <form className="flex max-w-2xl flex-col gap-4" onSubmit={submit}>
      <FormError error={error} />
      {account === undefined ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-zinc-700">You are</legend>
          <div className="flex gap-6">
            {ACCOUNT_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 text-sm">
                <input type="radio" name="type" value={type} defaultChecked={type === 'agent'} />
                {TYPE_LABELS.get(type)}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <TextField
        label="Display name"
        name="displayName"
        defaultValue={account?.displayName}
        minLength={2}
        maxLength={80}
        required
        error={fields.displayName}
      />
      {slugEditable ? (
        <TextField
          label="Profile address"
          name="slug"
          defaultValue={account.slug}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          maxLength={60}
          required
          hint="Lowercase letters, numbers and hyphens. Fixed once approved."
          error={fields.slug}
        />
      ) : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={aboutId} className="text-sm font-medium text-zinc-700">
          About
        </label>
        <textarea
          id={aboutId}
          name="about"
          rows={4}
          maxLength={2000}
          defaultValue={account?.about ?? ''}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Years of experience"
          name="experienceYears"
          type="number"
          min={0}
          max={70}
          defaultValue={account?.experienceYears ?? ''}
          error={fields.experienceYears}
        />
        <TextField
          label={licenseLabel}
          name="licenseNumber"
          maxLength={40}
          defaultValue={account?.licenseNumber ?? ''}
          required={account?.license.mandatory === true}
          error={fields.licenseNumber}
        />
      </div>
      <TextField
        label="Specialisations"
        name="specialisations"
        defaultValue={account?.specialisations.join(', ') ?? ''}
        hint="Separate with commas, e.g. Plots, Resale flats"
      />
      <AreaPicker selected={account?.areas.map((a) => a.locationId) ?? []} />
      {noAreas ? <p className="text-xs text-red-600">Pick at least one area you serve.</p> : null}
      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          {account === undefined ? 'Send for review' : 'Save changes'}
        </Button>
        {saved ? (
          <span role="status" className="text-sm text-emerald-700">
            Saved
          </span>
        ) : null}
      </div>
    </form>
  );
}
