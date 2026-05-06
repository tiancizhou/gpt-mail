-- GPT Mail Database Schema

CREATE TABLE IF NOT EXISTS User (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  wechatName TEXT,
  passwordHash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('ADMIN', 'USER')),
  name TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  lastLoginAt TEXT
);

CREATE TABLE IF NOT EXISTS GptAccount (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  loginEmail TEXT NOT NULL UNIQUE,
  encryptedPassword TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED', 'ARCHIVED')),
  capacity INTEGER NOT NULL DEFAULT 3,
  notes TEXT,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS MonthlyMembership (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES User(id),
  gptAccountId TEXT NOT NULL REFERENCES GptAccount(id),
  startsAt TEXT NOT NULL,
  endsAt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'CANCELLED')),
  requestLimitPerDay INTEGER NOT NULL DEFAULT 3,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS Cdk (
  id TEXT PRIMARY KEY,
  codeHash TEXT NOT NULL UNIQUE,
  code TEXT,
  displayCodeLast4 TEXT NOT NULL,
  durationDays INTEGER NOT NULL,
  maxUses INTEGER NOT NULL,
  remainingUses INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'UNUSED' CHECK (status IN ('UNUSED', 'ACTIVE', 'EXHAUSTED', 'EXPIRED', 'REVOKED')),
  gptAccountId TEXT NOT NULL REFERENCES GptAccount(id),
  createdByAdminId TEXT NOT NULL REFERENCES User(id),
  activatedAt TEXT,
  validUntil TEXT,
  redeemedByUserId TEXT REFERENCES User(id),
  redeemedByFingerprint TEXT,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS CdkRedemption (
  id TEXT PRIMARY KEY,
  cdkId TEXT NOT NULL REFERENCES Cdk(id),
  userId TEXT,
  ipHash TEXT,
  userAgent TEXT,
  status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED')),
  failureReason TEXT,
  emailCodeRequestId TEXT,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS EmailCodeRequest (
  id TEXT PRIMARY KEY,
  sourceType TEXT NOT NULL CHECK (sourceType IN ('MONTHLY', 'CDK', 'ADMIN_TEST')),
  userId TEXT REFERENCES User(id),
  cdkId TEXT REFERENCES Cdk(id),
  gptAccountId TEXT NOT NULL REFERENCES GptAccount(id),
  targetEmail TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'TIMEOUT')),
  verificationCodeMasked TEXT,
  providerMessageId TEXT,
  errorMessage TEXT,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  completedAt TEXT
);

CREATE TABLE IF NOT EXISTS AuditLog (
  id TEXT PRIMARY KEY,
  actorUserId TEXT REFERENCES User(id),
  action TEXT NOT NULL,
  entityType TEXT,
  entityId TEXT,
  metadataJson TEXT,
  ipHash TEXT,
  userAgent TEXT,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS RateLimitBucket (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  windowStart TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_membership_userId ON MonthlyMembership(userId);
CREATE INDEX IF NOT EXISTS idx_membership_gptAccountId ON MonthlyMembership(gptAccountId);
CREATE INDEX IF NOT EXISTS idx_membership_status_dates ON MonthlyMembership(status, startsAt, endsAt);
CREATE INDEX IF NOT EXISTS idx_cdk_status ON Cdk(status);
CREATE INDEX IF NOT EXISTS idx_cdk_gptAccountId ON Cdk(gptAccountId);
CREATE INDEX IF NOT EXISTS idx_redemption_cdkId ON CdkRedemption(cdkId);
CREATE INDEX IF NOT EXISTS idx_redemption_createdAt ON CdkRedemption(createdAt);
CREATE INDEX IF NOT EXISTS idx_emailRequest_sourceType ON EmailCodeRequest(sourceType);
CREATE INDEX IF NOT EXISTS idx_emailRequest_status ON EmailCodeRequest(status);
CREATE INDEX IF NOT EXISTS idx_emailRequest_createdAt ON EmailCodeRequest(createdAt);
CREATE INDEX IF NOT EXISTS idx_auditLog_actorUserId ON AuditLog(actorUserId);
CREATE INDEX IF NOT EXISTS idx_auditLog_action ON AuditLog(action);
CREATE INDEX IF NOT EXISTS idx_auditLog_createdAt ON AuditLog(createdAt);
