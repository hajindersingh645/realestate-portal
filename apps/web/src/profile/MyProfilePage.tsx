import {
  api,
  ApiError,
  Button,
  FormError,
  PageHeader,
  TextField,
  textOf,
  useSession,
} from '@hanu/web-kit';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import type { SubmitEvent } from 'react';
import { Link } from 'react-router';
import { ME_KEY, useMe, type Me } from '../api';
import { PATHS } from '../paths';

/** Name and email for everyone. The phone is the sign-in, so it is shown, not edited. */
export function MyProfilePage() {
  const me = useMe();
  const perms = useSession((s) => s.perms);
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (body: { name: string; email?: string }) =>
      api<Me>('/users/me', { method: 'PATCH', body }),
    onSuccess: (updated) => {
      queryClient.setQueryData(ME_KEY, updated);
      const { accessToken, perms: current } = useSession.getState();
      useSession.setState({
        user: { id: updated.id, name: updated.name, phone: updated.phone, email: updated.email },
        accessToken,
        perms: current,
      });
    },
  });

  if (me.data === undefined) {
    return <Loader2 aria-label="Loading" className="size-5 animate-spin text-zinc-400" />;
  }
  // One phone number, one side: only a professional sign-up can own a profile (identity refuses
  // anyone else). `profile.manage` means they already have one.
  const canBecomeProfessional =
    me.data.registeredAs === 'professional' && !perms.includes('profile.manage');

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = textOf(form, 'email').trim();
    save.mutate({ name: textOf(form, 'name').trim(), ...(email === '' ? {} : { email }) });
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <PageHeader title="My profile" />
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <FormError error={save.error} />
        <TextField label="Name" name="name" defaultValue={me.data.name} maxLength={100} required />
        <TextField
          label="Email (optional)"
          name="email"
          type="email"
          defaultValue={me.data.email ?? ''}
          error={save.error instanceof ApiError ? save.error.fields.email : undefined}
        />
        <TextField
          label="Mobile number"
          name="phone"
          value={me.data.phone}
          readOnly
          hint="Used to sign in"
        />
        <div className="flex items-center gap-3">
          <Button type="submit" loading={save.isPending}>
            Save
          </Button>
          {save.isSuccess ? (
            <span role="status" className="text-sm text-emerald-700">
              Saved
            </span>
          ) : null}
        </div>
      </form>
      {canBecomeProfessional ? (
        <p className="text-sm text-zinc-600">
          Are you an agent, consultant or agency?{' '}
          <Link className="font-medium text-accent hover:text-accent-hover" to={PATHS.professional}>
            Create a professional profile
          </Link>
        </p>
      ) : null}
    </div>
  );
}
