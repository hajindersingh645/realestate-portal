import { useUnlockedBy } from './requirements-api';

export interface UnlockedByListProps {
  requirementId: string;
  unlockCount: number;
  maxUnlocks: number;
}

/** The experts who took this buyer's contact, "n of 5". */
export function UnlockedByList({ requirementId, unlockCount, maxUnlocks }: UnlockedByListProps) {
  const unlocks = useUnlockedBy(requirementId, unlockCount > 0);
  return (
    <section className="flex max-w-2xl flex-col gap-2">
      <h2 className="text-base font-semibold">
        Unlocked by {unlockCount} of {maxUnlocks}
      </h2>
      {unlockCount === 0 ? (
        <p className="text-sm text-zinc-600">No expert has unlocked your contact yet.</p>
      ) : unlocks.isError ? (
        <p className="text-sm text-red-600">The list could not be loaded.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-100 rounded-lg border border-zinc-200">
          {(unlocks.data?.data ?? []).map((u) => (
            <li key={u.accountId} className="flex flex-col px-3 py-2 text-sm">
              <span className="font-medium">{u.displayName ?? 'Verified expert'}</span>
              {u.licenseNumber === null ? null : (
                <span className="text-zinc-500">Licence {u.licenseNumber}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {unlocks.data?.namesUnavailable === true ? (
        <p className="text-xs text-zinc-500">Names are unavailable right now.</p>
      ) : null}
    </section>
  );
}
