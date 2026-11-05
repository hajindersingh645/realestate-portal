import { api } from '@hanu/web-kit';
import { useQuery } from '@tanstack/react-query';
import type { MyRequirement } from '../requirements/requirements-api';

export type MyLead = Pick<
  MyRequirement,
  | 'id'
  | 'purpose'
  | 'propertyTypeId'
  | 'areas'
  | 'budgetMin'
  | 'budgetMax'
  | 'bedrooms'
  | 'areaMin'
  | 'areaMax'
  | 'areaUnit'
  | 'possession'
  | 'timeline'
  | 'loanNeeded'
  | 'notes'
> & { unlockId: string; unlockedAt: string; buyer: { name: string; phone: string } };

export function useMyLeads() {
  return useQuery({
    queryKey: ['leads', 'mine'],
    queryFn: () => api<{ data: MyLead[] }>('/lead/my-leads'),
  });
}
