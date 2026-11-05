import type { RequirementDecision } from '@hanu/contracts';
import { Button, ConfirmDialog, PageHeader } from '@hanu/web-kit';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { formatDateTime } from '../access/access-api';
import { PATHS } from '../paths';
import {
  DECISION_MESSAGES,
  REQUIREMENT_ACTIONS,
  useRequirement,
  useRequirementDecision,
} from './requirements-api';
import { RequirementStatusBadge } from './RequirementStatusBadge';
import { useReferenceNames } from './useReferenceNames';

const ERRORS = { CONFLICT: 'Someone already decided this requirement. Reload to see it.' };

/** One requirement with the buyer's contact, for staff to check and decide. */
export function RequirementDetailPage() {
  const id = useParams().id ?? '';
  const requirement = useRequirement(id);
  const decision = useRequirementDecision(id);
  const names = useReferenceNames();
  const [choice, setChoice] = useState<{ action: RequirementDecision; label: string } | null>(null);

  if (requirement.isPending)
    return <Loader2 aria-label="Loading" className="size-5 animate-spin text-zinc-400" />;
  if (requirement.isError)
    return <p className="text-sm text-red-600">This requirement could not be loaded.</p>;
  const r = requirement.data;
  const actions = REQUIREMENT_ACTIONS.get(r.status) ?? [];
  const details: [string, string][] = [
    ['Buyer', `${r.buyerName ?? '—'} · ${r.buyerPhone ?? '—'}`],
    ['Looking to', `${r.purpose === 'buy' ? 'Buy' : 'Rent'} ${names.type(r.propertyTypeId)}`],
    ['Areas', r.areas.map((a) => names.place(a.locationId)).join(', ')],
    ['Budget', `${names.money(r.budgetMin)} – ${names.money(r.budgetMax)}`],
    ['Bedrooms', r.bedrooms.join(', ') || '—'],
    [
      'Size',
      r.areaMin === null && r.areaMax === null
        ? '—'
        : `${r.areaMin ?? '…'} – ${r.areaMax ?? '…'} ${r.areaUnit ?? ''}`,
    ],
    ['Possession', r.possession ?? '—'],
    ['Timeline', r.timeline ?? '—'],
    ['Home loan', r.loanNeeded === null ? '—' : r.loanNeeded ? 'Needed' : 'Not needed'],
    [
      'Unlocks',
      r.maxUnlocks === null ? '—' : `${String(r.unlockCount)} of ${String(r.maxUnlocks)}`,
    ],
  ];

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link to={PATHS.requirements} className="text-sm text-zinc-500 hover:text-zinc-800">
        ← Requirements
      </Link>
      <PageHeader
        title="Requirement"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <RequirementStatusBadge status={r.status} />
            {actions.map((x) => (
              <Button
                key={x.action}
                variant={x.action === 'approve' ? 'primary' : 'secondary'}
                onClick={() => {
                  decision.reset();
                  setChoice(x);
                }}
              >
                {x.label}
              </Button>
            ))}
          </div>
        }
      />
      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
        {details.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-zinc-500">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Notes</h2>
        <p className="whitespace-pre-line text-sm text-zinc-700">{r.notes ?? '—'}</p>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">History</h2>
        <ol aria-label="History" className="flex flex-col gap-2">
          {r.transitions.map((t) => (
            <li
              key={`${t.createdAt}-${t.toStatus}`}
              className="rounded-lg border border-zinc-200 p-3 text-sm"
            >
              <p className="font-medium">
                {t.fromStatus === null ? 'Created' : `${t.fromStatus} → ${t.toStatus}`}
              </p>
              <p className="text-xs text-zinc-500">{formatDateTime(t.createdAt)}</p>
              {t.reason === null ? null : <p className="mt-1 whitespace-pre-line">{t.reason}</p>}
            </li>
          ))}
        </ol>
      </section>
      {choice === null ? null : (
        <ConfirmDialog
          open
          title={`${choice.label} this requirement?`}
          message={DECISION_MESSAGES.get(choice.action) ?? ''}
          confirmLabel={choice.label}
          danger={choice.action !== 'approve'}
          reasonRequired={choice.action !== 'approve'}
          pending={decision.isPending}
          error={decision.error}
          errorMessages={ERRORS}
          onClose={() => {
            setChoice(null);
          }}
          onConfirm={(reason) => {
            decision.mutate(
              choice.action === 'approve'
                ? { action: 'approve' }
                : { action: choice.action, reason },
              {
                onSuccess: () => {
                  setChoice(null);
                },
              },
            );
          }}
        />
      )}
    </div>
  );
}
