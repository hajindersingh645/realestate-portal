import { api, PageHeader } from '@hanu/web-kit';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { ACCOUNT_KEY, useMyAccount, type AccountBody, type MyAccount } from './account-api';
import { ProfileForm } from './ProfileForm';
import { StatusBanner } from './StatusBanner';

/** Create the profile, or see its status and edit it. Suspended and banned profiles are frozen. */
export function ProfessionalPage() {
  const account = useMyAccount();
  const queryClient = useQueryClient();
  const store = (saved: MyAccount) => {
    queryClient.setQueryData(ACCOUNT_KEY, saved);
  };
  const create = useMutation({
    mutationFn: (body: AccountBody) => api<MyAccount>('/accounts/me', { method: 'POST', body }),
    onSuccess: store,
  });
  const update = useMutation({
    mutationFn: (body: AccountBody) => api<MyAccount>('/accounts/me', { method: 'PATCH', body }),
    onSuccess: store,
  });
  const resubmit = useMutation({
    mutationFn: () => api<MyAccount>('/accounts/me/resubmit', { method: 'POST' }),
    onSuccess: (saved) => {
      store(saved);
      update.reset();
    },
  });

  if (account.isPending)
    return <Loader2 aria-label="Loading" className="size-5 animate-spin text-zinc-400" />;
  if (account.isError)
    return <p className="text-sm text-red-600">Your profile could not be loaded.</p>;

  if (account.data === null) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Create your professional profile" />
        <p className="max-w-2xl text-sm text-zinc-600">
          Staff check every profile before buyers can see it. You can edit it while you wait.
        </p>
        <ProfileForm
          error={create.error}
          pending={create.isPending}
          saved={false}
          onSubmit={create.mutate}
        />
      </div>
    );
  }

  const current = account.data;
  const editable =
    current.status === 'pending' || current.status === 'rejected' || current.status === 'approved';
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Professional profile" />
      <StatusBanner
        account={current}
        resubmitting={resubmit.isPending}
        onResubmit={() => {
          resubmit.mutate();
        }}
      />
      {editable ? (
        <ProfileForm
          key={current.status}
          account={current}
          error={update.error ?? resubmit.error}
          pending={update.isPending}
          saved={update.isSuccess}
          onSubmit={update.mutate}
        />
      ) : null}
    </div>
  );
}
