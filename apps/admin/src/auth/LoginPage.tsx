import { useMutation } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import {
  api,
  AuthCard,
  Button,
  FormError,
  safeNext,
  type SessionTokens,
  TextField,
  textOf,
  useSession,
} from '@hanu/web-kit';

const WRONG = {
  UNAUTHORIZED: 'Email, password or code is wrong.',
  INVALID_OTP: 'Email, password or code is wrong.',
  INVALID_CREDENTIALS: 'Email, password or code is wrong.',
};

export function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const status = useSession((s) => s.status);
  const signIn = useSession((s) => s.signIn);
  const next = safeNext(params.get('next'));
  const [challengeId, setChallengeId] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      api<{ challengeId: string }>('/auth/staff/login', { method: 'POST', body }),
    onSuccess: (result) => {
      setChallengeId(result.challengeId);
    },
  });
  const verify = useMutation({
    mutationFn: (code: string) =>
      api<SessionTokens>('/auth/staff/verify', { method: 'POST', body: { challengeId, code } }),
    onSuccess: (tokens) => {
      signIn(tokens);
      void navigate(next, { replace: true });
    },
  });

  if (status === 'signed-in' && !verify.isSuccess) return <Navigate to={next} replace />;

  function onCredentials(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    start.mutate({ email: textOf(form, 'email'), password: textOf(form, 'password') });
  }

  function onCode(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    verify.mutate(textOf(new FormData(event.currentTarget), 'code'));
  }

  if (challengeId === null) {
    return (
      <AuthCard title="Sign in to Hanu Admin" subtitle="Staff only. Use your work email.">
        <form key="credentials" className="flex flex-col gap-4" onSubmit={onCredentials}>
          <FormError error={start.error} messages={WRONG} />
          <TextField label="Email" name="email" type="email" autoComplete="username" required />
          <TextField
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          <Button type="submit" loading={start.isPending}>
            Continue
          </Button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Enter your code" subtitle="We sent a 6-digit code to your phone.">
      {/* A separate key, so React does not reuse the email input (and its value) for the code. */}
      <form key="code" className="flex flex-col gap-4" onSubmit={onCode}>
        <FormError error={verify.error} messages={WRONG} />
        <TextField
          label="6-digit code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
        />
        <Button type="submit" loading={verify.isPending}>
          Sign in
        </Button>
        <button
          type="button"
          className="text-sm text-zinc-500 hover:text-zinc-800"
          onClick={() => {
            setChallengeId(null);
            verify.reset();
          }}
        >
          Use a different account
        </button>
      </form>
    </AuthCard>
  );
}
