import { X } from 'lucide-react';
import { useEffect, useEffectEvent, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** `drawer` slides in from the left (phone menu); `center` is a normal dialog. */
  variant?: 'center' | 'drawer';
  /** False for dialogs that must be closed with their own button (e.g. a link shown only once). */
  dismissible?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A modal dialog: focus moves in on open, Tab stays inside, Escape or the backdrop closes it, and
 * focus returns to whatever opened it. Hand-written because jsdom has no `showModal()`.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  variant = 'center',
  dismissible = true,
}: DialogProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  // An effect event, so the effect below does not re-run (and steal focus) when `onClose` changes.
  const close = useEffectEvent(() => {
    if (dismissible) onClose();
  });

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel.current)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
        return;
      }
      if (event.key !== 'Tab' || panel.current === null) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const firstItem = items[0];
      const lastItem = items.at(-1);
      if (firstItem === undefined || lastItem === undefined) return;
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      opener?.focus();
    };
  }, [open]);

  if (!open) return null;

  const position =
    variant === 'drawer'
      ? 'fixed inset-y-0 left-0 w-72 max-w-[85vw] rounded-r-2xl'
      : 'fixed inset-x-4 top-[10vh] mx-auto max-h-[80vh] w-auto max-w-lg rounded-2xl sm:inset-x-0';

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-zinc-900/30"
        onClick={dismissible ? onClose : undefined}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`${position} flex flex-col overflow-hidden border border-zinc-200 bg-white shadow-xl outline-none`}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer !== undefined && (
          <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-3">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
