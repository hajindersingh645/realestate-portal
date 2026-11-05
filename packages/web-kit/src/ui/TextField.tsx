import { useId, type InputHTMLAttributes } from 'react';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  error?: string;
  hint?: string;
}

export function TextField({ label, name, error, hint, className = '', ...rest }: TextFieldProps) {
  const id = useId();
  const describedBy =
    error !== undefined ? `${id}-error` : hint !== undefined ? `${id}-hint` : undefined;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-zinc-700">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error !== undefined}
        aria-describedby={describedBy}
        className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-base outline-none sm:h-9 sm:text-sm placeholder:text-zinc-400 focus:border-accent focus:ring-2 focus:ring-accent/20 aria-invalid:border-red-400"
        {...rest}
      />
      {error !== undefined ? (
        <p id={`${id}-error`} className="text-xs text-red-600">
          {error}
        </p>
      ) : (
        hint !== undefined && (
          <p id={`${id}-hint`} className="text-xs text-zinc-500">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
