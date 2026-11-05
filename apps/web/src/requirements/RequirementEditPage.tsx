import { api, PageHeader } from '@hanu/web-kit';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useReference } from '../api';
import { requirementPath } from '../paths';
import { RequirementForm } from './RequirementForm';
import {
  REQUIREMENTS_KEY,
  useMyRequirement,
  type MyRequirement,
  type RequirementBody,
} from './requirements-api';

/**
 * New requirement (`/requirements/new`) or edit-and-resubmit (`/requirements/:id/edit`). Sending
 * saves the draft, then submits it with consent. If the submit fails, the draft is kept and the
 * next attempt updates it instead of creating another.
 */
export function RequirementEditPage() {
  const { id } = useParams();
  const existing = useMyRequirement(id);
  const reference = useReference();
  const [createdId, setCreatedId] = useState<string | undefined>(undefined);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const send = useMutation({
    mutationFn: async (body: RequirementBody) => {
      let target = id ?? createdId;
      if (target === undefined) {
        const created = await api<MyRequirement>('/lead/requirements', { method: 'POST', body });
        target = created.id;
        setCreatedId(target);
      } else {
        await api(`/lead/requirements/mine/${target}`, { method: 'PATCH', body });
      }
      return await api<MyRequirement>(`/lead/requirements/mine/${target}/submit`, {
        method: 'POST',
        body: { consent: true },
      });
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: REQUIREMENTS_KEY });
      await navigate(requirementPath(saved.id));
    },
  });

  // Selects take their saved value at mount, so wait for their options.
  if ((id !== undefined && existing.isPending) || reference.isPending)
    return <Loader2 aria-label="Loading" className="size-5 animate-spin text-zinc-400" />;
  if (existing.isError)
    return <p className="text-sm text-red-600">This requirement could not be loaded.</p>;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={id === undefined ? 'Post a requirement' : 'Edit your requirement'} />
      <p className="max-w-2xl text-sm text-zinc-600">
        Staff check every requirement before experts see it. Your name is shown; your phone number
        is shared only with the experts who unlock it.
      </p>
      <RequirementForm
        requirement={existing.data}
        error={send.error}
        pending={send.isPending}
        onSend={send.mutate}
      />
    </div>
  );
}
