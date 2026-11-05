import type { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
}

const VARIANTS = new Map<NonNullable<ButtonProps['variant']>, string>([
  ['primary', 'bg-accent text-white hover:bg-accent-hover border-transparent'],
  ['secondary', 'bg-white text-zinc-800 hover:bg-zinc-50 border-zinc-200'],
  ['danger', 'bg-white text-red-600 hover:bg-red-50 border-red-200'],
  ['ghost', 'bg-transparent text-zinc-700 hover:bg-zinc-100 border-transparent'],
]);

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled === true || loading}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS.get(variant) ?? ''} ${className}`}
      {...rest}
    >
      {loading && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
      {children}
    </button>
  );
}
