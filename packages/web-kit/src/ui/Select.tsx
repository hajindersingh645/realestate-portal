import { useId, type SelectHTMLAttributes } from 'react';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  error?: string;
  /** Shown first with an empty value, e.g. "All cities". */
  placeholder?: string;
}

export function Select({
  label,
  name,
  options,
  error,
  placeholder,
  className = '',
  ...rest
}: SelectProps) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-zinc-700">
        {label}
      </label>
      <select
        id={id}
        name={name}
        aria-invalid={error !== undefined}
        aria-describedby={error === undefined ? undefined : `${id}-error`}
        className="h-10 rounded-lg border border-zinc-200 bg-white px-2.5 text-base outline-none sm:h-9 sm:text-sm focus:border-accent focus:ring-2 focus:ring-accent/20"
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error !== undefined && (
        <p id={`${id}-error`} className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
