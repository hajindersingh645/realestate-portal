import { X } from 'lucide-react';
import { useEffect, useEffectEvent, useId, useRef, useState, type ReactNode } from 'react';
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

/** How long the exit animation runs before the dialog leaves the page. Matches `duration-200`. */
const EXIT_MS = 200;
// Curves from the animation guide: an iOS-like drawer, and a strong ease-out for the dialog.
const DRAWER_EASE = 'ease-[cubic-bezier(0.32,0.72,0,1)]';
const DIALOG_EASE = 'ease-[cubic-bezier(0.23,1,0.32,1)]';

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
  // Stays rendered for EXIT_MS after `open` turns false, so it can animate out.
  const [rendered, setRendered] = useState(open);
  if (open && !rendered) setRendered(true);
  const closing = rendered && !open;

  useEffect(() => {
    if (!closing) return undefined;
    const timer = setTimeout(() => {
      setRendered(false);
    }, EXIT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [closing]);

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

  if (!rendered) return null;

  const position =
    variant === 'drawer'
      ? 'fixed inset-y-0 left-0 w-72 max-w-[85vw] rounded-r-2xl'
      : 'fixed inset-x-4 top-[10vh] mx-auto max-h-[80vh] w-auto max-w-lg rounded-2xl sm:inset-x-0';
  // Enter from `starting:` (@starting-style), exit by flipping to the same values while `closing`.
  // Reduced motion keeps the fade and drops the movement.
  const motion =
    variant === 'drawer'
      ? `transition-[translate,opacity] ${DRAWER_EASE} ${
          closing
            ? 'duration-200 motion-safe:-translate-x-full motion-reduce:opacity-0'
            : 'duration-300 motion-safe:starting:-translate-x-full motion-reduce:starting:opacity-0'
        }`
      : `transition-[scale,opacity] ${DIALOG_EASE} ${
          closing
            ? 'duration-150 opacity-0 motion-safe:scale-96'
            : 'duration-200 starting:opacity-0 motion-safe:starting:scale-96'
        }`;

  return createPortal(
    // While closing it is out of the accessibility tree and takes no clicks.
    <div
      className="fixed inset-0 z-50"
      data-closing={closing ? '' : undefined}
      aria-hidden={closing}
      inert={closing}
    >
      <div
        aria-hidden="true"
        className={`absolute inset-0 bg-zinc-900/30 transition-opacity duration-200 ${DIALOG_EASE} ${closing ? 'opacity-0' : 'starting:opacity-0'}`}
        onClick={dismissible ? onClose : undefined}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`${position} ${motion} flex flex-col overflow-hidden border border-zinc-200 bg-white shadow-xl outline-none`}
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
