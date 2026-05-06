export type UserRole = "ADMIN" | "USER";
export type UserStatus = "ACTIVE" | "DISABLED";
export type GptAccountStatus = "ACTIVE" | "DISABLED" | "ARCHIVED";
export type MembershipStatus = "ACTIVE" | "EXPIRED" | "CANCELLED";
export type CdkStatus = "UNUSED" | "ACTIVE" | "EXHAUSTED" | "EXPIRED" | "REVOKED";
export type EmailCodeSourceType = "MONTHLY" | "CDK" | "ADMIN_TEST";
export type EmailCodeRequestStatus = "PENDING" | "SUCCESS" | "FAILED" | "TIMEOUT";
export type CdkRedemptionStatus = "SUCCESS" | "FAILED";

export interface UserRow {
  id: string;
  email: string;
  wechatName: string | null;
  passwordHash: string;
  role: UserRole;
  name: string | null;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface GptAccountRow {
  id: string;
  label: string;
  loginEmail: string;
  encryptedPassword: string;
  status: GptAccountStatus;
  capacity: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyMembershipRow {
  id: string;
  userId: string;
  gptAccountId: string;
  startsAt: string;
  endsAt: string;
  status: MembershipStatus;
  requestLimitPerDay: number;
  createdAt: string;
  updatedAt: string;
}

export interface CdkRow {
  id: string;
  codeHash: string;
  code: string | null;
  displayCodeLast4: string;
  durationDays: number;
  maxUses: number;
  remainingUses: number;
  status: CdkStatus;
  gptAccountId: string;
  createdByAdminId: string;
  activatedAt: string | null;
  validUntil: string | null;
  redeemedByUserId: string | null;
  redeemedByFingerprint: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CdkRedemptionRow {
  id: string;
  cdkId: string;
  userId: string | null;
  ipHash: string | null;
  userAgent: string | null;
  status: CdkRedemptionStatus;
  failureReason: string | null;
  emailCodeRequestId: string | null;
  createdAt: string;
}

export interface EmailCodeRequestRow {
  id: string;
  sourceType: EmailCodeSourceType;
  userId: string | null;
  cdkId: string | null;
  gptAccountId: string;
  targetEmail: string;
  status: EmailCodeRequestStatus;
  verificationCodeMasked: string | null;
  providerMessageId: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface AuditLogRow {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadataJson: string | null;
  ipHash: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface RateLimitBucketRow {
  id: string;
  key: string;
  windowStart: string;
  count: number;
  createdAt: string;
  updatedAt: string;
}
