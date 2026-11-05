import { useMutation } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../api/client';
import { PATHS } from '../paths';
import { AuthCard } from '../ui/AuthCard';
import { Button } from '../ui/Button';
import { FormError } from '../ui/FormError';
import { textOf } from '../ui/form-values';
import { TextField } from '../ui/TextField';

const MIN_PASSWORD_LENGTH = 12;
const INVALID = 'This link has expired or was already used. Ask your admin for a new one.';

export function SetupPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [mismatch, setMismatch] = useState(false);
  const setup = useMutation({
    mutationFn: (password: string) =>
      api<undefined>('/auth/staff/setup', { method: 'POST', body: { token, password } }),
  });

  if (token === null || token === '') {
    return (
      <AuthCard title="Set your password">
        <p className="text-sm text-zinc-600">
          This link is incomplete. Open the full link you were sent, or ask your admin for a new
          one.
        </p>
      </AuthCard>
    );
  }

  if (setup.isSuccess) {
    return (
      <AuthCard
        title="Password set"
        subtitle="You can now sign in with your email, this password and a code sent to your phone."
      >
        <Link
          to={PATHS.login}
          className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-accent text-sm font-medium text-white hover:bg-accent-hover"
        >
          Sign in
        </Link>
      </AuthCard>
    );
  }

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = textOf(form, 'password');
    const matches = password === textOf(form, 'confirm');
    setMismatch(!matches);
    if (matches) setup.mutate(password);
  }

  return (
    <AuthCard
      title="Set your password"
      subtitle={`At least ${String(MIN_PASSWORD_LENGTH)} characters. A short sentence is easy to remember.`}
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <FormError error={setup.error} messages={{ SETUP_LINK_INVALID: INVALID }} />
        <TextField
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
        <TextField
          label="Confirm password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          {...(mismatch ? { error: 'Passwords do not match' } : {})}
        />
        <Button type="submit" loading={setup.isPending}>
          Set password
        </Button>
      </form>
    </AuthCard>
  );
}
