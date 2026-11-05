import type { AccountStatus } from '@hanu/contracts';
import { StatusBadge, type StatusBadgeProps } from '@hanu/web-kit';

export interface AccountStatusBadgeProps {
  status: AccountStatus;
}

const TONES = new Map<AccountStatus, StatusBadgeProps['tone']>([
  ['pending', 'warning'],
  ['approved', 'success'],
  ['rejected', 'neutral'],
  ['suspended', 'danger'],
  ['banned', 'danger'],
]);

export function AccountStatusBadge({ status }: AccountStatusBadgeProps) {
  return <StatusBadge tone={TONES.get(status) ?? 'neutral'}>{status}</StatusBadge>;
}
