import { useId, type ReactNode, type SubmitEvent } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { FormError } from './FormError';

export interface FormDialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (form: FormData) => void;
  pending: boolean;
  /** Shown above the fields; field errors are shown by the fields themselves. */
  error: unknown;
  submitLabel?: string;
  children: ReactNode;
}

/** A dialog holding one form. A refused save keeps it open with everything typed. */
export function FormDialog({
  open,
  title,
  onClose,
  onSubmit,
  pending,
  error,
  submitLabel = 'Save',
  children,
}: FormDialogProps) {
  const formId = useId();
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget));
  }
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={pending}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <FormError error={error} />
        {children}
      </form>
    </Dialog>
  );
}
