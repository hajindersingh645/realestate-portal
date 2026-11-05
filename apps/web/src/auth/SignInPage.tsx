import {
  api,
  ApiError,
  AuthCard,
  Button,
  FormError,
  safeNext,
  type SessionTokens,
  TextField,
  textOf,
  useSession,
} from '@hanu/web-kit';
import { useMutation } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { PATHS } from '../paths';
import { SignupDetailsForm, type SignupDetails } from './SignupDetailsForm';

const WRONG_CODE = 'That code is wrong or has expired.';
const MESSAGES = { INVALID_OTP: WRONG_CODE, UNAUTHORIZED: WRONG_CODE };

type Login = { phone: string; code: string } & Partial<SignupDetails>;

/** Phone, then code. A new number then gives a name, picks a side and accepts the notice. */
export function SignInPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const status = useSession((s) => s.status);
  const signIn = useSession((s) => s.signIn);
  const next = safeNext(params.get('next'), PATHS.home);
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [needsDetails, setNeedsDetails] = useState(false);

  const send = useMutation({
    mutationFn: (number: string) =>
      api<null>('/auth/otp', { method: 'POST', body: { phone: number } }),
    onSuccess: (_result, number) => {
      setPhone(number);
    },
  });
  const login = useMutation({
    mutationFn: (body: Login) => api<SessionTokens>('/auth/login', { method: 'POST', body }),
    onSuccess: (tokens) => {
      signIn(tokens);
      void navigate(next, { replace: true });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'SIGNUP_DETAILS_REQUIRED')
        setNeedsDetails(true);
    },
  });

  if (status === 'signed-in' && !login.isSuccess) return <Navigate to={next} replace />;

  function restart() {
    setPhone(null);
    setCode(null);
    setNeedsDetails(false);
    login.reset();
  }

  if (phone === null) {
    return (
      <AuthCard
        title="Sign in to Hanu.property"
        subtitle="New here? The same steps create your account."
      >
        <form
          key="phone"
          className="flex flex-col gap-4"
          onSubmit={(event: SubmitEvent<HTMLFormElement>) => {
            event.preventDefault();
            send.mutate(textOf(new FormData(event.currentTarget), 'phone'));
          }}
        >
          <FormError error={send.error} />
          <TextField label="Mobile number" name="phone" type="tel" autoComplete="tel" required />
          <Button type="submit" loading={send.isPending}>
            Send code
          </Button>
        </form>
      </AuthCard>
    );
  }

  if (needsDetails && code !== null) {
    return (
      <AuthCard title="Create your account" subtitle={`New number: ${phone}`}>
        <SignupDetailsForm
          error={
            login.error instanceof ApiError && login.error.code === 'SIGNUP_DETAILS_REQUIRED'
              ? null
              : login.error
          }
          pending={login.isPending}
          onSubmit={(details) => {
            login.mutate({ phone, code, ...details });
          }}
        />
        <button
          type="button"
          className="mt-3 text-sm text-zinc-500 hover:text-zinc-800"
          onClick={restart}
        >
          Use a different number
        </button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Enter your code" subtitle={`We sent a 6-digit code to ${phone}.`}>
      <form
        key="code"
        className="flex flex-col gap-4"
        onSubmit={(event: SubmitEvent<HTMLFormElement>) => {
          event.preventDefault();
          const typed = textOf(new FormData(event.currentTarget), 'code');
          setCode(typed);
          login.mutate({ phone, code: typed });
        }}
      >
        <FormError error={login.error} messages={MESSAGES} />
        <TextField
          label="6-digit code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
        />
        <Button type="submit" loading={login.isPending}>
          Continue
        </Button>
        <button
          type="button"
          className="text-sm text-zinc-500 hover:text-zinc-800"
          onClick={restart}
        >
          Use a different number
        </button>
      </form>
    </AuthCard>
  );
}
