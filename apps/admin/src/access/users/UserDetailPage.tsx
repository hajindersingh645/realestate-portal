import { ArrowLeft, History, KeyRound, Plus, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { PATHS } from '../../paths';
import { useCan } from '../../session/useCan';
import { Button } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { FormError } from '../../ui/FormError';
import { StatusBadge } from '../../ui/StatusBadge';
import {
  ACCESS_ERRORS,
  formatDateTime,
  useIdentityWrite,
  useRoles,
  useUser,
  type UserDetail,
} from '../access-api';
import { NewLinkDialog } from './NewLinkDialog';
import { OverrideDialog } from './OverrideDialog';
import { UserStatusBadge } from './UserStatusBadge';

type StatusAction = { status: 'active' | 'suspended' | 'banned'; label: string } | null;

interface SectionProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}

function Section({ title, action, children }: SectionProps) {
  return (
    <section className="rounded-xl border border-zinc-200 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function UserDetailPage() {
  const { id = '' } = useParams();
  const user = useUser(id);
  const canManageUsers = useCan('admin.user.manage');
  const canManageAccess = useCan('admin.access.manage');
  const canViewAudit = useCan('admin.audit.view');
  const roles = useRoles(canManageAccess);
  const [statusAction, setStatusAction] = useState<StatusAction>(null);
  const [addingOverride, setAddingOverride] = useState(false);
  const [newLink, setNewLink] = useState(false);
  const [roleToAdd, setRoleToAdd] = useState('');
  const setStatus = useIdentityWrite('Status changed');
  const grants = useIdentityWrite();

  if (user.isPending) return <p className="py-16 text-center text-zinc-500">Loading…</p>;
  if (user.error !== null) return <FormError error={user.error} />;
  const u: UserDetail = user.data;
  const available = (roles.data ?? []).filter((r) => !u.roles.some((held) => held.id === r.id));

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <Link
        to={PATHS.users}
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Users
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{u.name}</h1>
            <UserStatusBadge status={u.status} />
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            <span className="capitalize">{u.registeredAs}</span> · {u.phone}
            {u.email !== null && ` · ${u.email}`} · joined {formatDateTime(u.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canViewAudit && (
            <Link
              to={`${PATHS.auditLog}?targetId=${u.id}`}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 px-3.5 text-sm font-medium hover:bg-zinc-50"
            >
              <History aria-hidden="true" className="size-4" /> View history
            </Link>
          )}
          {canManageAccess && u.registeredAs === 'staff' && (
            <Button
              variant="secondary"
              onClick={() => {
                setNewLink(true);
              }}
            >
              <KeyRound aria-hidden="true" className="size-4" /> New setup link
            </Button>
          )}
          {canManageUsers &&
            (u.status === 'active' ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setStatusAction({ status: 'suspended', label: 'Suspend' });
                  }}
                >
                  Suspend
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setStatusAction({ status: 'banned', label: 'Ban' });
                  }}
                >
                  Ban
                </Button>
              </>
            ) : (
              <Button
                onClick={() => {
                  setStatusAction({ status: 'active', label: 'Reactivate' });
                }}
              >
                Reactivate
              </Button>
            ))}
        </div>
      </div>

      <Section title="Roles">
        {u.roles.length === 0 && <p className="text-sm text-zinc-500">No roles.</p>}
        <ul className="flex flex-wrap gap-2">
          {u.roles.map((r) => (
            <li
              key={r.id}
              className="inline-flex items-center gap-1 rounded-full border border-zinc-200 py-1 pl-3 pr-1.5 text-sm"
            >
              {r.name}
              {canManageAccess && (
                <button
                  type="button"
                  aria-label={`Remove ${r.name}`}
                  onClick={() => {
                    grants.mutate({ path: `/users/${u.id}/roles/${r.id}`, method: 'DELETE' });
                  }}
                  className="rounded-full p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                >
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
        {canManageAccess && available.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="text-sm">
              <span className="sr-only">Role to add</span>
              <select
                value={roleToAdd}
                onChange={(e) => {
                  setRoleToAdd(e.target.value);
                }}
                className="h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-sm"
              >
                <option value="">Choose a role…</option>
                {available.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="secondary"
              disabled={roleToAdd === ''}
              loading={grants.isPending}
              onClick={() => {
                grants.mutate(
                  { path: `/users/${u.id}/roles/${roleToAdd}`, method: 'PUT' },
                  {
                    onSuccess: () => {
                      setRoleToAdd('');
                    },
                  },
                );
              }}
            >
              <Plus aria-hidden="true" className="size-4" /> Add role
            </Button>
          </div>
        )}
        <div className="mt-3">
          <FormError error={grants.error} messages={ACCESS_ERRORS} />
        </div>
      </Section>

      <Section
        title="Overrides"
        action={
          canManageAccess && (
            <Button
              variant="ghost"
              onClick={() => {
                setAddingOverride(true);
              }}
            >
              <Plus aria-hidden="true" className="size-4" /> Add override
            </Button>
          )
        }
      >
        {u.overrides.length === 0 ? (
          <p className="text-sm text-zinc-500">
            None. This user has exactly what their roles give.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-100">
            {u.overrides.map((o) => (
              <li
                key={o.permission}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="min-w-0">
                  <StatusBadge tone={o.effect === 'allow' ? 'success' : 'danger'}>
                    {o.effect}
                  </StatusBadge>{' '}
                  <span className="font-mono text-xs">{o.permission}</span>
                  <span className="block text-xs text-zinc-500">{o.reason}</span>
                </span>
                {canManageAccess && (
                  <Button
                    variant="ghost"
                    aria-label={`Remove override ${o.permission}`}
                    onClick={() => {
                      grants.mutate({
                        path: `/users/${u.id}/overrides/${o.permission}`,
                        method: 'DELETE',
                      });
                    }}
                  >
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="What they can do">
        {u.permissions.length === 0 ? (
          <p className="text-sm text-zinc-500">No permissions.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {u.permissions.map((p) => (
              <li
                key={p}
                className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-700"
              >
                {p}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {statusAction !== null && (
        <ConfirmDialog
          open
          title={`${statusAction.label} ${u.name}?`}
          message={
            statusAction.status === 'active'
              ? 'They can sign in and use the site again.'
              : 'They are signed out everywhere at once and cannot sign in until reactivated.'
          }
          confirmLabel={statusAction.label}
          danger={statusAction.status !== 'active'}
          reasonRequired
          pending={setStatus.isPending}
          error={setStatus.error}
          errorMessages={ACCESS_ERRORS}
          onClose={() => {
            setStatusAction(null);
            setStatus.reset();
          }}
          onConfirm={(reason) => {
            setStatus.mutate(
              {
                path: `/users/${u.id}/status`,
                method: 'POST',
                body: { status: statusAction.status, reason },
              },
              {
                onSuccess: () => {
                  setStatusAction(null);
                },
              },
            );
          }}
        />
      )}
      {addingOverride && (
        <OverrideDialog
          userId={u.id}
          onClose={() => {
            setAddingOverride(false);
          }}
        />
      )}
      {newLink && (
        <NewLinkDialog
          userId={u.id}
          name={u.name}
          onClose={() => {
            setNewLink(false);
          }}
        />
      )}
    </div>
  );
}
