import { StatusBadge } from '../../ui/StatusBadge';

export interface UserStatusBadgeProps {
  status: string;
}

export function UserStatusBadge({ status }: UserStatusBadgeProps) {
  return (
    <StatusBadge
      tone={status === 'active' ? 'success' : status === 'suspended' ? 'warning' : 'danger'}
    >
      {status}
    </StatusBadge>
  );
}
