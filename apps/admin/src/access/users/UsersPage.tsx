import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PATHS } from '../../paths';
import { useCan } from '../../session/useCan';
import { Button } from '../../ui/Button';
import { DataList } from '../../ui/DataList';
import { EmptyState } from '../../ui/EmptyState';
import { FilterTabs } from '../../ui/FilterTabs';
import { PageHeader } from '../../ui/PageHeader';
import { SearchInput } from '../../ui/SearchInput';
import { formatDateTime, useUsers, type UserSummary } from '../access-api';
import { AddStaffDialog } from './AddStaffDialog';
import { UserStatusBadge } from './UserStatusBadge';

const STATUSES = ['active', 'suspended', 'banned'];

export function UsersPage() {
  const [params, setParams] = useSearchParams();
  const canManageAccess = useCan('admin.access.manage');
  const [adding, setAdding] = useState(false);
  const kind = params.get('kind');
  const status = STATUSES.find((s) => s === params.get('status'));
  // The API matches a whole phone number only; a partial one would be refused.
  const phoneParam = params.get('phone') ?? '';
  const phone = phoneParam.replace(/\D/g, '').length >= 10 ? phoneParam : undefined;
  const list = useUsers({
    ...(status === undefined ? {} : { status }),
    ...(phone === undefined ? {} : { phone }),
  });
  const rows = list.data?.filter(
    (u) => kind === null || (kind === 'staff') === (u.registeredAs === 'staff'),
  );

  const name = (u: UserSummary) => (
    <Link to={PATHS.user(u.id)} className="font-medium hover:text-accent">
      {u.name}
    </Link>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Users"
        {...(rows === undefined ? {} : { count: rows.length })}
        actions={
          canManageAccess && (
            <Button
              onClick={() => {
                setAdding(true);
              }}
            >
              <UserPlus aria-hidden="true" className="size-4" /> Add staff
            </Button>
          )
        }
      />
      <FilterTabs
        label="Kind of user"
        param="kind"
        tabs={[
          { value: 'all', label: 'All' },
          { value: 'staff', label: 'Staff' },
          { value: 'members', label: 'Members' },
        ]}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput label="Search by full phone number" param="phone" />
        <label className="flex items-center text-sm">
          <span className="sr-only">Status</span>
          <select
            value={status ?? ''}
            onChange={(e) => {
              const value = e.target.value;
              setParams((prev) => {
                const next = new URLSearchParams(prev);
                if (value === '') next.delete('status');
                else next.set('status', value);
                return next;
              });
            }}
            className="h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="banned">Banned</option>
          </select>
        </label>
      </div>
      <p className="text-xs text-zinc-500">Newest 50 shown. Search by phone to find anyone else.</p>
      <DataList
        caption="Users"
        rows={rows}
        rowKey={(u) => u.id}
        loading={list.isPending}
        error={list.error}
        onRetry={() => void list.refetch()}
        empty={
          <EmptyState
            title="No users found"
            description="Change the filters, or search by a full phone number."
          />
        }
        columns={[
          { header: 'Name', cell: name },
          { header: 'Phone', cell: (u) => <span className="tabular-nums">{u.phone}</span> },
          { header: 'Email', cell: (u) => u.email ?? '—' },
          { header: 'Type', cell: (u) => <span className="capitalize">{u.registeredAs}</span> },
          { header: 'Status', cell: (u) => <UserStatusBadge status={u.status} /> },
          {
            header: 'Joined',
            cell: (u) => <span className="text-zinc-500">{formatDateTime(u.createdAt)}</span>,
          },
        ]}
        card={(u) => (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              {name(u)}
              <p className="truncate text-xs capitalize text-zinc-500">
                {u.registeredAs} · {u.phone}
              </p>
            </div>
            <UserStatusBadge status={u.status} />
          </div>
        )}
      />
      {adding && (
        <AddStaffDialog
          onClose={() => {
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}
