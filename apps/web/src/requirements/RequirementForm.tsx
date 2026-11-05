import { REQUIREMENT_PURPOSES } from '@hanu/contracts';
import { ApiError, Button, FormError, Select, TextField, textOf } from '@hanu/web-kit';
import { useId, useState, type SubmitEvent } from 'react';
import { useReference } from '../api';
import { AreaPicker } from '../professional/AreaPicker';
import { RequirementFacts } from './RequirementFacts';
import { toMajor, toMinor, type MyRequirement, type RequirementBody } from './requirements-api';
import { asBody } from './useDescribe';

export interface RequirementFormProps {
  /** Absent: a new requirement. Present: edit it before resubmitting. */
  requirement?: MyRequirement;
  error: unknown;
  pending: boolean;
  onSend: (body: RequirementBody) => void;
}

export const CONSENT_LINE =
  'I agree to share my contact with up to 5 verified property experts who unlock this requirement';
const BEDROOMS = [1, 2, 3, 4, 5];

/**
 * Fill in, then review with the consent line, then send. The fields stay mounted (hidden) during
 * review, so "Back" keeps what was typed. A field error from the server returns to the form.
 */
export function RequirementForm({ requirement, error, pending, onSend }: RequirementFormProps) {
  const notesId = useId();
  const reference = useReference();
  const [draft, setDraft] = useState<{ body: RequirementBody; error: unknown } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const fields = error instanceof ApiError ? error.fields : {};
  const reviewing = draft !== null && (error === draft.error || Object.keys(fields).length === 0);
  const data = reference.data;
  const currency = data?.platform.currency ?? 'INR';
  const options = (group: string) =>
    (data?.lookups ?? [])
      .filter((l) => l.group === group && l.isActive)
      .map((l) => ({ value: l.code, label: l.label }));
  const saved = requirement === undefined ? undefined : asBody(requirement);

  function review(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const locationIds = form.getAll('locationIds').map(String);
    const min = textOf(form, 'budgetMin').trim();
    const max = textOf(form, 'budgetMax').trim();
    if (locationIds.length === 0) {
      setProblem('Pick at least one area.');
      return;
    }
    if (BigInt(min) > BigInt(max)) {
      setProblem('The lowest budget is more than the highest.');
      return;
    }
    setProblem(null);
    const optional = (name: string) => {
      const value = textOf(form, name).trim();
      return value === '' ? {} : { [name]: value };
    };
    const loan = textOf(form, 'loanNeeded');
    setDraft({
      error,
      body: {
        purpose: textOf(form, 'purpose') as RequirementBody['purpose'],
        propertyTypeId: textOf(form, 'propertyTypeId'),
        locationIds,
        budgetMin: toMinor(min, currency),
        budgetMax: toMinor(max, currency),
        bedrooms: form.getAll('bedrooms').map(Number),
        ...optional('areaMin'),
        ...optional('areaMax'),
        ...optional('areaUnit'),
        ...optional('possession'),
        ...optional('timeline'),
        ...(loan === '' ? {} : { loanNeeded: loan === 'yes' }),
        ...optional('notes'),
      },
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <form className="flex flex-col gap-4" hidden={reviewing} onSubmit={review}>
        <FormError error={Object.keys(fields).length > 0 ? null : error} />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-zinc-700">Looking to</legend>
          <div className="flex gap-6">
            {REQUIREMENT_PURPOSES.map((purpose) => (
              <label key={purpose} className="flex items-center gap-2 py-1 text-sm">
                <input
                  type="radio"
                  name="purpose"
                  value={purpose}
                  defaultChecked={(saved?.purpose ?? 'buy') === purpose}
                />
                {purpose === 'buy' ? 'Buy' : 'Rent'}
              </label>
            ))}
          </div>
        </fieldset>
        <Select
          label="Property type"
          name="propertyTypeId"
          required
          placeholder="Choose a type"
          defaultValue={saved?.propertyTypeId ?? ''}
          options={(data?.propertyTypes ?? [])
            .filter((t) => t.isActive)
            .map((t) => ({ value: t.id, label: t.name }))}
          error={fields.propertyTypeId}
        />
        <AreaPicker legend="Where are you looking?" selected={saved?.locationIds ?? []} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label={`Budget from (${currency})`}
            name="budgetMin"
            type="number"
            inputMode="numeric"
            min={0}
            required
            defaultValue={saved === undefined ? '' : toMajor(saved.budgetMin, currency)}
            error={fields.budgetMin}
          />
          <TextField
            label={`Budget up to (${currency})`}
            name="budgetMax"
            type="number"
            inputMode="numeric"
            min={0}
            required
            defaultValue={saved === undefined ? '' : toMajor(saved.budgetMax, currency)}
            error={fields.budgetMax}
          />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-zinc-700">Bedrooms</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {BEDROOMS.map((n) => (
              <label key={n} className="flex items-center gap-2 py-1 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  name="bedrooms"
                  value={n}
                  defaultChecked={saved?.bedrooms?.includes(n)}
                />
                {n === 5 ? '5 or more' : n}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextField
            label="Size from"
            name="areaMin"
            inputMode="decimal"
            pattern="[0-9]{1,8}(\.[0-9]{1,2})?"
            defaultValue={saved?.areaMin ?? ''}
            error={fields.areaMin}
          />
          <TextField
            label="Size up to"
            name="areaMax"
            inputMode="decimal"
            pattern="[0-9]{1,8}(\.[0-9]{1,2})?"
            defaultValue={saved?.areaMax ?? ''}
            error={fields.areaMax}
          />
          <Select
            label="Unit"
            name="areaUnit"
            placeholder="—"
            defaultValue={saved?.areaUnit ?? ''}
            options={options('area_unit')}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Select
            label="Possession"
            name="possession"
            placeholder="—"
            defaultValue={saved?.possession ?? ''}
            options={options('possession')}
          />
          <Select
            label="When"
            name="timeline"
            placeholder="—"
            defaultValue={saved?.timeline ?? ''}
            options={options('timeline')}
          />
          <Select
            label="Home loan"
            name="loanNeeded"
            placeholder="—"
            defaultValue={saved?.loanNeeded === undefined ? '' : saved.loanNeeded ? 'yes' : 'no'}
            options={[
              { value: 'yes', label: 'Needed' },
              { value: 'no', label: 'Not needed' },
            ]}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={notesId} className="text-sm font-medium text-zinc-700">
            Notes
          </label>
          <textarea
            id={notesId}
            name="notes"
            rows={4}
            maxLength={1000}
            defaultValue={saved?.notes ?? ''}
            aria-invalid={fields.notes === undefined ? undefined : true}
            aria-describedby={`${notesId}-hint`}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-base outline-none sm:text-sm focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <p
            id={`${notesId}-hint`}
            className={`text-xs ${fields.notes === undefined ? 'text-zinc-500' : 'text-red-600'}`}
          >
            {fields.notes ??
              'No phone numbers, emails or links: experts reach you after they unlock.'}
          </p>
        </div>
        {problem === null ? null : <p className="text-xs text-red-600">{problem}</p>}
        <div>
          <Button type="submit">Review</Button>
        </div>
      </form>
      {reviewing ? (
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            onSend(draft.body);
          }}
        >
          <h2 className="text-base font-semibold">Check your requirement</h2>
          <FormError error={error === draft.error ? null : error} />
          <RequirementFacts requirement={draft.body} />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 size-4" name="consent" required />
            {CONSENT_LINE}
          </label>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" loading={pending}>
              Send for review
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDraft(null);
              }}
            >
              Back to edit
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
