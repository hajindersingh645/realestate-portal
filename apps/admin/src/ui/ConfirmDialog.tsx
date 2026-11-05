import { useState } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { FormError } from './FormError';
import { TextField } from './TextField';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  /** Asks for a reason (at least 3 characters) and passes it to `onConfirm`. */
  reasonRequired?: boolean;
  pending: boolean;
  error: unknown;
  errorMessages?: Record<string, string>;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger = false,
  reasonRequired = false,
  pending,
  error,
  errorMessages,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const ready = !reasonRequired || reason.trim().length >= 3;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            disabled={!ready}
            loading={pending}
            onClick={() => {
              onConfirm(reason.trim());
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormError
          error={error}
          {...(errorMessages === undefined ? {} : { messages: errorMessages })}
        />
        <p className="text-sm text-zinc-600">{message}</p>
        {reasonRequired && (
          <TextField
            label="Reason"
            name="reason"
            value={reason}
            hint="Recorded in the audit log."
            onChange={(e) => {
              setReason(e.target.value);
            }}
          />
        )}
      </div>
    </Dialog>
  );
}
