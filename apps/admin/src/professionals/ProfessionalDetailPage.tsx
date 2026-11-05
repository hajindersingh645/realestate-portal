import type { AccountDecision } from '@hanu/contracts';
import { api, Button, ConfirmDialog, PageHeader } from '@hanu/web-kit';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { formatDateTime } from '../access/access-api';
import { PATHS } from '../paths';
import { AccountStatusBadge } from './AccountStatusBadge';
import { ACTIONS, DECISION_ERRORS, useAccount, useDecision } from './professionals-api';

const MESSAGES = new Map<AccountDecision, string>([
  ['approve', 'The profile goes live for buyers, and the owner gets an SMS.'],
  ['reject', 'The owner sees your reason as written, can edit and resubmit.'],
  ['suspend', 'The profile is hidden from buyers until reactivated.'],
  ['ban', 'The profile is closed for good. This cannot be undone here.'],
  ['reactivate', 'The profile goes live again.'],
]);

/** One account: profile, owner, areas and history, with the decisions its status allows. */
export function ProfessionalDetailPage() {
  const id = useParams().id ?? '';
  const account = useAccount(id);
  const decision = useDecision(id);
  const places = useQuery({
    queryKey: ['catalog', 'reference'],
    queryFn: () => api<{ locations: { id: string; name: string }[] }>('/catalog/reference'),
    staleTime: 5 * 60_000,
  });
  const [choice, setChoice] = useState<{ action: AccountDecision; label: string } | null>(null);

  if (account.isPending)
    return <Loader2 aria-label="Loading" className="size-5 animate-spin text-zinc-400" />;
  if (account.isError)
    return <p className="text-sm text-red-600">This account could not be loaded.</p>;
  const a = account.data;
  const placeName = new Map(places.data?.locations.map((p) => [p.id, p.name]));
  const actions = ACTIONS.get(a.status) ?? [];

  const details: [string, string][] = [
    ['Type', a.type],
    ['Public address', a.slug],
    ['Experience', a.experienceYears === null ? '—' : `${String(a.experienceYears)} years`],
    ['Licence', a.licenseNumber ?? '—'],
    ['Specialisations', a.specialisations.join(', ') || '—'],
    ['Areas', a.areas.map((x) => placeName.get(x.locationId) ?? x.locationId).join(', ') || '—'],
    [
      'Owner',
      `${a.owner.name} · ${a.owner.phone}${a.owner.email === null ? '' : ` · ${a.owner.email}`}`,
    ],
    ['Created', formatDateTime(a.createdAt)],
  ];

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link to={PATHS.professionals} className="text-sm text-zinc-500 hover:text-zinc-800">
        ← Professionals
      </Link>
      <PageHeader
        title={a.displayName}
        actions={
          <div className="flex items-center gap-2">
            <AccountStatusBadge status={a.status} />
            {actions.map((x) => (
              <Button
                key={x.action}
                variant={
                  x.action === 'approve' || x.action === 'reactivate' ? 'primary' : 'secondary'
                }
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
      <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-2 text-sm">
        {details.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-zinc-500">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">About</h2>
        <p className="whitespace-pre-line text-sm text-zinc-700">{a.about ?? '—'}</p>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">History</h2>
        <ol aria-label="History" className="flex flex-col gap-2">
          {a.transitions.map((t) => (
            <li
              key={`${t.createdAt}-${t.toStatus}`}
              className="rounded-lg border border-zinc-200 p-3 text-sm"
            >
              <p className="font-medium">
                {t.fromStatus === null ? 'Created' : `${t.fromStatus} → ${t.toStatus}`}
              </p>
              <p className="text-xs text-zinc-500">
                {t.actorName ?? 'System'} · {formatDateTime(t.createdAt)}
              </p>
              {t.reason === null ? null : <p className="mt-1 whitespace-pre-line">{t.reason}</p>}
            </li>
          ))}
        </ol>
      </section>
      {choice === null ? null : (
        <ConfirmDialog
          open
          title={`${choice.label} ${a.displayName}?`}
          message={MESSAGES.get(choice.action) ?? ''}
          confirmLabel={choice.label}
          danger={choice.action === 'ban' || choice.action === 'suspend'}
          reasonRequired={choice.action !== 'approve'}
          pending={decision.isPending}
          error={decision.error}
          errorMessages={DECISION_ERRORS}
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
