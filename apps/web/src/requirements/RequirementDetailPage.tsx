import { api, Button, ConfirmDialog, PageHeader } from '@hanu/web-kit';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { requirementPath } from '../paths';
import { RequirementFacts } from './RequirementFacts';
import { REQUIREMENTS_KEY, useMyRequirement, type MyRequirement } from './requirements-api';
import { RequirementStatusBadge } from './RequirementStatusBadge';
import { UnlockedByList } from './UnlockedByList';
import { asBody } from './useDescribe';

const EDIT_LINK =
  'inline-flex items-center rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent-hover';

export function RequirementDetailPage() {
  const { id = '' } = useParams();
  const requirement = useMyRequirement(id);
  const [closing, setClosing] = useState(false);
  const queryClient = useQueryClient();
  const close = useMutation({
    mutationFn: () => api<MyRequirement>(`/lead/requirements/mine/${id}/close`, { method: 'POST' }),
    onSuccess: async () => {
      setClosing(false);
      await queryClient.invalidateQueries({ queryKey: REQUIREMENTS_KEY });
    },
  });

  if (requirement.isPending)
    return <Loader2 aria-label="Loading" className="size-5 animate-spin text-zinc-400" />;
  if (requirement.isError)
    return <p className="text-sm text-red-600">This requirement could not be loaded.</p>;
  const r = requirement.data;
  const closable =
    r.status === 'live' || r.status === 'pending_payment' || r.status === 'pending_review';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Your requirement"
        actions={
          closable ? (
            <Button
              variant="secondary"
              onClick={() => {
                setClosing(true);
              }}
            >
              Close
            </Button>
          ) : undefined
        }
      />
      <div>
        <RequirementStatusBadge status={r.status} />
      </div>
      {r.status === 'rejected' ? (
        <div className="flex max-w-2xl flex-col items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
          <p>
            Not approved. Reason: <span className="font-medium">{r.rejectReason}</span>
          </p>
          <Link to={requirementPath(r.id, true)} className={EDIT_LINK}>
            Edit and resubmit
          </Link>
        </div>
      ) : null}
      {r.status === 'pending_payment' ? (
        <p className="max-w-2xl rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          Approved. Payment opens soon; your requirement goes live once it does.
        </p>
      ) : null}
      {r.status === 'pending_review' ? (
        <p className="max-w-2xl text-sm text-zinc-600">Staff are checking your requirement.</p>
      ) : null}
      <RequirementFacts requirement={asBody(r)} />
      {r.status === 'live' && r.maxUnlocks !== null ? (
        <UnlockedByList
          requirementId={r.id}
          unlockCount={r.unlockCount}
          maxUnlocks={r.maxUnlocks}
        />
      ) : null}
      <ConfirmDialog
        open={closing}
        title="Close this requirement?"
        message="Experts will no longer see it. This can't be undone."
        confirmLabel="Close requirement"
        danger
        pending={close.isPending}
        error={close.error}
        onConfirm={() => {
          close.mutate();
        }}
        onClose={() => {
          setClosing(false);
        }}
      />
    </div>
  );
}
