import { Button } from '@hanu/web-kit';
import type { MyAccount } from './account-api';

export interface StatusBannerProps {
  account: MyAccount;
  onResubmit: () => void;
  resubmitting: boolean;
}

const TONE = new Map<MyAccount['status'], string>([
  ['pending', 'border-amber-200 bg-amber-50 text-amber-900'],
  ['approved', 'border-emerald-200 bg-emerald-50 text-emerald-900'],
  ['rejected', 'border-red-200 bg-red-50 text-red-900'],
  ['suspended', 'border-red-200 bg-red-50 text-red-900'],
  ['banned', 'border-zinc-300 bg-zinc-100 text-zinc-800'],
]);

/** Where the account stands, and the one thing the owner can do about it. */
export function StatusBanner({ account, onResubmit, resubmitting }: StatusBannerProps) {
  return (
    <div
      role="status"
      className={`flex flex-col gap-2 rounded-lg border p-4 text-sm ${TONE.get(account.status) ?? ''}`}
    >
      {account.status === 'pending' ? (
        <p>Your profile is waiting for review. We will text you when it is decided.</p>
      ) : null}
      {account.status === 'approved' ? (
        <p>
          Your profile is live. Public address: <code className="font-mono">{account.slug}</code>
        </p>
      ) : null}
      {account.status === 'rejected' ? (
        <>
          <p className="font-medium">Your profile was not approved. The reviewer wrote:</p>
          <p className="whitespace-pre-line">{account.rejectReason}</p>
          <p>Fix the profile below, save it, then send it back.</p>
          <div>
            <Button variant="secondary" loading={resubmitting} onClick={onResubmit}>
              Resubmit for review
            </Button>
          </div>
        </>
      ) : null}
      {account.status === 'suspended' ? (
        <p>Your profile is suspended and hidden from buyers. Contact support to find out more.</p>
      ) : null}
      {account.status === 'banned' ? <p>Your profile has been closed.</p> : null}
    </div>
  );
}
