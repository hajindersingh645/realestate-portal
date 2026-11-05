import { CircleAlert, CircleCheck } from 'lucide-react';
import { useToasts } from './toast-store';

/** Where toasts appear. Screen readers hear them through the live region. */
export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-center gap-2 sm:left-auto sm:right-4 sm:items-end"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="pointer-events-auto flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm text-white shadow-lg"
        >
          {t.tone === 'success' ? (
            <CircleCheck aria-hidden="true" className="size-4 text-emerald-400" />
          ) : (
            <CircleAlert aria-hidden="true" className="size-4 text-red-400" />
          )}
          {t.message}
        </div>
      ))}
    </div>
  );
}
