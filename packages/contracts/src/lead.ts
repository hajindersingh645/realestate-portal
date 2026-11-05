/** A buyer's requirement, from draft to its end (design phase 3, §3A). */
export const REQUIREMENT_STATUSES = [
  'draft',
  'pending_review',
  'rejected',
  'pending_payment',
  'live',
  'expired',
  'closed',
  'hidden',
  'fake',
] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export const REQUIREMENT_PURPOSES = ['buy', 'rent'] as const;
export type RequirementPurpose = (typeof REQUIREMENT_PURPOSES)[number];

/** Sent on `requirement.approved` (status live or pending_payment) and `requirement.rejected`. */
export interface RequirementDecisionPayload {
  requirementId: string;
  buyerUserId: string;
  status: 'live' | 'pending_payment' | 'rejected';
  reason: string | null;
}
