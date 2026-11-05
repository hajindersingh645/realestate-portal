import { ApiError } from '../api/errors';

export interface FormErrorProps {
  error: unknown;
  /** Replaces the server's message for these codes. */
  messages?: Record<string, string>;
}

/** The message a form shows above its fields when the server refuses it. Never a stack trace. */
export function FormError({ error, messages = {} }: FormErrorProps) {
  if (error === null || error === undefined) return null;
  const text =
    error instanceof ApiError
      ? (messages[error.code] ?? error.message)
      : 'Could not reach the server. Check your connection and try again.';
  return (
    <p
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      {text}
    </p>
  );
}
