import { Button, FormError, TextField, textOf } from '@hanu/web-kit';
import { useState, type SubmitEvent } from 'react';
import { useReference } from '../api';

export interface SignupDetails {
  name: string;
  consent: true;
  noticeBlockId: string;
  registeredAs: 'buyer' | 'professional';
}

export interface SignupDetailsFormProps {
  error: unknown;
  pending: boolean;
  onSubmit: (details: SignupDetails) => void;
}

const SIDES = [
  { value: 'buyer', label: "I'm buying or renting" },
  { value: 'professional', label: "I'm a real estate professional" },
] as const;

/** Name, side and the current data-protection notice. The notice's id goes with the sign-up. */
export function SignupDetailsForm({ error, pending, onSubmit }: SignupDetailsFormProps) {
  const reference = useReference();
  const notice = reference.data?.notices['signup.data_notice'];
  const [missingConsent, setMissingConsent] = useState(false);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (notice === undefined) return;
    if (form.get('consent') !== 'on') {
      setMissingConsent(true);
      return;
    }
    onSubmit({
      name: textOf(form, 'name'),
      consent: true,
      noticeBlockId: notice.id,
      registeredAs: form.get('side') === 'professional' ? 'professional' : 'buyer',
    });
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      <FormError error={error} />
      <TextField label="Your name" name="name" autoComplete="name" maxLength={100} required />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-zinc-700">I am here because</legend>
        {SIDES.map((side) => (
          <label key={side.value} className="flex items-center gap-2 py-1 text-sm">
            <input
              type="radio"
              name="side"
              value={side.value}
              defaultChecked={side.value === 'buyer'}
            />
            {side.label}
          </label>
        ))}
      </fieldset>
      {notice === undefined ? (
        <p className="text-sm text-zinc-500" role="status">
          {reference.isPending
            ? 'Loading the notice…'
            : 'Sign-up is not available right now. Try again later.'}
        </p>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <p className="whitespace-pre-line text-xs text-zinc-600">{notice.body}</p>
          {notice.links.length > 0 ? (
            <p className="flex flex-wrap gap-3 text-xs">
              {notice.links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-accent hover:text-accent-hover"
                >
                  {link.label}
                </a>
              ))}
            </p>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="consent"
              onChange={() => {
                setMissingConsent(false);
              }}
            />
            I have read and agree to this notice
          </label>
          {missingConsent ? (
            <p className="text-xs text-red-600">Tick the notice to continue.</p>
          ) : null}
        </div>
      )}
      <Button type="submit" loading={pending} disabled={notice === undefined}>
        Create account
      </Button>
    </form>
  );
}
