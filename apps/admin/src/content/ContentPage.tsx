import { api, Button, FormError, PageHeader, TextField, textOf, toast } from '@hanu/web-kit';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useId, useState, type SubmitEvent } from 'react';
import { formatDateTime } from '../access/access-api';

interface Link {
  label: string;
  url: string;
}

interface Block {
  id: string;
  key: string;
  version: number;
  body: string;
  links: Link[];
  createdAt: string;
}

const KEY = 'signup.data_notice';
const PATH = '/catalog/admin/content-blocks';
const LINK_ROWS = [0, 1, 2, 3, 4];
/** Same rule as the server, plus no `//host` (a link to another site). */
const SAFE_URL = /^(\/(?!\/)|https:\/\/)/;

/** The data-protection notice shown at sign-up. Every publish is a new version; old ones stay. */
export function ContentPage() {
  const queryClient = useQueryClient();
  const textId = useId();
  const [badLink, setBadLink] = useState(false);
  const blocks = useQuery({
    queryKey: ['catalog', 'content-blocks'],
    queryFn: async () => (await api<{ data: Block[] }>(PATH)).data,
  });
  const publish = useMutation({
    mutationFn: (body: { body: string; links: Link[] }) =>
      api<Block>(`${PATH}/${KEY}`, { method: 'POST', body }),
    onSuccess: async (saved) => {
      toast.success(`Version ${String(saved.version)} is live`);
      await queryClient.invalidateQueries({ queryKey: ['catalog', 'content-blocks'] });
    },
  });

  if (blocks.isPending)
    return <Loader2 aria-label="Loading" className="size-5 animate-spin text-zinc-400" />;
  if (blocks.isError)
    return <p className="text-sm text-red-600">The notice could not be loaded.</p>;
  const versions = blocks.data.filter((b) => b.key === KEY).sort((x, y) => y.version - x.version);
  const current = versions[0];
  const nextVersion = (current?.version ?? 0) + 1;

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const links = LINK_ROWS.map((i) => ({
      label: textOf(form, `label${String(i)}`).trim(),
      url: textOf(form, `url${String(i)}`).trim(),
    })).filter((l) => l.label !== '' || l.url !== '');
    if (links.some((l) => l.label === '' || !SAFE_URL.test(l.url))) {
      setBadLink(true);
      return;
    }
    setBadLink(false);
    publish.mutate({ body: textOf(form, 'body').trim(), links });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader title="Sign-up notice" />
      <p className="text-sm text-zinc-600">
        New users tick this text when they sign up, and their account records which version they
        accepted. Publishing makes a new version; earlier ones are kept.
      </p>
      {current === undefined ? (
        <p className="text-sm text-zinc-500">
          No version yet. Sign-up stays closed until one is published.
        </p>
      ) : (
        <h2 className="text-sm font-semibold">Version {current.version} (current)</h2>
      )}
      <form key={current?.version ?? 0} className="flex flex-col gap-4" onSubmit={submit}>
        <FormError error={publish.error} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor={textId} className="text-sm font-medium text-zinc-700">
            Text
          </label>
          <textarea
            id={textId}
            name="body"
            rows={8}
            maxLength={4000}
            required
            defaultValue={current?.body ?? ''}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-zinc-700">Links (up to 5)</legend>
          {LINK_ROWS.map((i) => (
            <div key={i} className="grid grid-cols-2 gap-3">
              <TextField
                label={`Link ${String(i + 1)} label`}
                name={`label${String(i)}`}
                maxLength={60}
                defaultValue={current?.links[i]?.label ?? ''}
              />
              <TextField
                label={`Link ${String(i + 1)} address`}
                name={`url${String(i)}`}
                maxLength={300}
                placeholder="/privacy or https://…"
                defaultValue={current?.links[i]?.url ?? ''}
              />
            </div>
          ))}
          {badLink ? (
            <p className="text-xs text-red-600">
              Links must start with / or https://, and each needs a label.
            </p>
          ) : null}
        </fieldset>
        <div>
          <Button type="submit" loading={publish.isPending}>
            Publish version {nextVersion}
          </Button>
        </div>
      </form>
      {versions.length > 1 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Earlier versions</h2>
          {versions.slice(1).map((v) => (
            <details key={v.id} className="rounded-lg border border-zinc-200 p-3 text-sm">
              <summary className="cursor-pointer">
                Version {v.version} · {formatDateTime(v.createdAt)}
              </summary>
              <p className="mt-2 whitespace-pre-line text-zinc-700">{v.body}</p>
            </details>
          ))}
        </section>
      ) : null}
    </div>
  );
}
