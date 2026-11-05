export const REGISTERED_AS = ['buyer', 'professional', 'staff'] as const;
export type RegisteredAs = (typeof REGISTERED_AS)[number];

export const USER_STATUSES = ['active', 'suspended', 'banned'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const OTP_PURPOSES = ['login', 'staff_login'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

/** The only event that carries a secret. Never log it; the kit logger redacts `code` and `phone`. */
export interface OtpRequestedPayload {
  challengeId: string;
  phone: string; // E.164
  code: string;
  purpose: OtpPurpose;
  expiresAt: string; // ISO-8601; consumers drop the message after this
  locale: string;
}

/** Sent on signup and on every change to name, phone or email. Consumers keep their own copy. */
export interface UserContactPayload {
  userId: string;
  name: string;
  phone: string;
  email: string | null;
}

/** Anything that changes what the user may do. The gateway refuses tokens issued before `changedAt`. */
export interface UserAccessChangedPayload {
  userId: string;
  changedAt: string; // ISO-8601
}

export const ACCOUNT_TYPES = ['agent', 'consultant', 'agency'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_STATUSES = ['pending', 'approved', 'rejected', 'suspended', 'banned'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/** A staff decision on a professional account. `reason` is null only for an approval. */
export interface AccountDecisionPayload {
  accountId: string;
  ownerUserId: string;
  status: AccountStatus;
  reason: string | null;
}
