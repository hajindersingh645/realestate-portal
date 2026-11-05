import type { RequirementStatus } from '@hanu/contracts';
import { StatusBadge, type StatusBadgeProps } from '@hanu/web-kit';

export interface RequirementStatusBadgeProps {
  status: RequirementStatus;
}

const TONES = new Map<RequirementStatus, StatusBadgeProps['tone']>([
  ['pending_review', 'warning'],
  ['pending_payment', 'warning'],
  ['live', 'success'],
  ['hidden', 'danger'],
  ['fake', 'danger'],
]);

export function RequirementStatusBadge({ status }: RequirementStatusBadgeProps) {
  return (
    <StatusBadge tone={TONES.get(status) ?? 'neutral'}>{status.replace('_', ' ')}</StatusBadge>
  );
}
