import { Copy } from 'lucide-react';
import { Button } from '../../ui/Button';
import { toast } from '../../ui/toast-store';
import { formatDateTime } from '../access-api';

export interface SetupLinkPanelProps {
  setupUrl: string;
  expiresAt: string;
}

/** The one-time link to send to a staff member. It is shown once; a new one can be made later. */
export function SetupLinkPanel({ setupUrl, expiresAt }: SetupLinkPanelProps) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(setupUrl);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy. Select the link and copy it yourself.');
    }
  }
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-accent/30 bg-orange-50/50 p-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
        Setup link
        <input
          readOnly
          value={setupUrl}
          onFocus={(e) => {
            e.target.select();
          }}
          className="h-9 rounded-lg border border-zinc-200 bg-white px-3 font-mono text-xs text-zinc-700"
        />
      </label>
      <Button variant="secondary" onClick={() => void copy()} className="self-start">
        <Copy aria-hidden="true" className="size-4" /> Copy link
      </Button>
      <p className="text-xs text-zinc-600">
        Send this link to them yourself (for example on WhatsApp). It works once and expires on{' '}
        {formatDateTime(expiresAt)}. Anyone with the link can set the password, so send it only to
        them.
      </p>
    </div>
  );
}
