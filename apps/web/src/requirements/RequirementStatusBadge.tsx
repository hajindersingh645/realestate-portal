import type { RequirementStatus } from '@hanu/contracts';
import { StatusBadge, type StatusBadgeProps } from '@hanu/web-kit';

export interface RequirementStatusBadgeProps {
  status: RequirementStatus;
}

const LABELS = new Map<RequirementStatus, [string, StatusBadgeProps['tone']]>([
  ['draft', ['Draft', 'neutral']],
  ['pending_review', ['Waiting for review', 'warning']],
  ['rejected', ['Not approved', 'danger']],
  ['pending_payment', ['Approved, payment opens soon', 'warning']],
  ['live', ['Live', 'success']],
  ['expired', ['Expired', 'neutral']],
  ['closed', ['Closed', 'neutral']],
  ['hidden', ['Hidden by staff', 'danger']],
  ['fake', ['Removed', 'danger']],
]);

export function RequirementStatusBadge({ status }: RequirementStatusBadgeProps) {
  const [label, tone] = LABELS.get(status) ?? [status, 'neutral'];
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}
