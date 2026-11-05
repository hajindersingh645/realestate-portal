import { StatusBadge } from '../ui/StatusBadge';

export interface ActiveBadgeProps {
  active: boolean;
}

export function ActiveBadge({ active }: ActiveBadgeProps) {
  return (
    <StatusBadge tone={active ? 'success' : 'neutral'}>
      {active ? 'Active' : 'Inactive'}
    </StatusBadge>
  );
}
