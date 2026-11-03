import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { useIdentityWrite, type SetupLink } from '../access-api';
import { SetupLinkPanel } from './SetupLinkPanel';

export interface NewLinkDialogProps {
  userId: string;
  name: string;
  onClose: () => void;
}

/** A fresh setup link (forgotten password or lost link). Any earlier link stops working. */
export function NewLinkDialog({ userId, name, onClose }: NewLinkDialogProps) {
  const issue = useIdentityWrite<SetupLink>();
  return (
    <Dialog
      open
      title={`New setup link for ${name}`}
      dismissible={issue.data === undefined}
      onClose={onClose}
      footer={
        issue.data === undefined ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              loading={issue.isPending}
              onClick={() => {
                issue.mutate({ path: `/staff/${userId}/setup-link`, method: 'POST' });
              }}
            >
              Create link
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Done</Button>
        )
      }
    >
      {issue.data === undefined ? (
        <div className="flex flex-col gap-3">
          <FormError error={issue.error} />
          <p className="text-sm text-zinc-600">
            Use this when they forgot their password or lost their first link. Their earlier link
            stops working, and they choose a new password with this one.
          </p>
        </div>
      ) : (
        <SetupLinkPanel setupUrl={issue.data.setupUrl} expiresAt={issue.data.expiresAt} />
      )}
    </Dialog>
  );
}
