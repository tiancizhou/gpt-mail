-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastLoginAt" DATETIME
);

-- CreateTable
CREATE TABLE "GptAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "loginEmail" TEXT NOT NULL,
    "encryptedPassword" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "capacity" INTEGER NOT NULL DEFAULT 3,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MonthlyMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gptAccountId" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "requestLimitPerDay" INTEGER NOT NULL DEFAULT 3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MonthlyMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MonthlyMembership_gptAccountId_fkey" FOREIGN KEY ("gptAccountId") REFERENCES "GptAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Cdk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codeHash" TEXT NOT NULL,
    "displayCodeLast4" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "maxUses" INTEGER NOT NULL,
    "remainingUses" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNUSED',
    "gptAccountId" TEXT NOT NULL,
    "createdByAdminId" TEXT NOT NULL,
    "activatedAt" DATETIME,
    "validUntil" DATETIME,
    "redeemedByUserId" TEXT,
    "redeemedByFingerprint" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Cdk_gptAccountId_fkey" FOREIGN KEY ("gptAccountId") REFERENCES "GptAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Cdk_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Cdk_redeemedByUserId_fkey" FOREIGN KEY ("redeemedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CdkRedemption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cdkId" TEXT NOT NULL,
    "userId" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "status" TEXT NOT NULL,
    "failureReason" TEXT,
    "emailCodeRequestId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CdkRedemption_cdkId_fkey" FOREIGN KEY ("cdkId") REFERENCES "Cdk" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailCodeRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceType" TEXT NOT NULL,
    "userId" TEXT,
    "cdkId" TEXT,
    "gptAccountId" TEXT NOT NULL,
    "targetEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "verificationCodeMasked" TEXT,
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "EmailCodeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EmailCodeRequest_cdkId_fkey" FOREIGN KEY ("cdkId") REFERENCES "Cdk" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EmailCodeRequest_gptAccountId_fkey" FOREIGN KEY ("gptAccountId") REFERENCES "GptAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadataJson" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "windowStart" DATETIME NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "GptAccount_loginEmail_key" ON "GptAccount"("loginEmail");

-- CreateIndex
CREATE INDEX "MonthlyMembership_userId_idx" ON "MonthlyMembership"("userId");

-- CreateIndex
CREATE INDEX "MonthlyMembership_gptAccountId_idx" ON "MonthlyMembership"("gptAccountId");

-- CreateIndex
CREATE INDEX "MonthlyMembership_status_startsAt_endsAt_idx" ON "MonthlyMembership"("status", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Cdk_codeHash_key" ON "Cdk"("codeHash");

-- CreateIndex
CREATE INDEX "Cdk_status_idx" ON "Cdk"("status");

-- CreateIndex
CREATE INDEX "Cdk_gptAccountId_idx" ON "Cdk"("gptAccountId");

-- CreateIndex
CREATE INDEX "CdkRedemption_cdkId_idx" ON "CdkRedemption"("cdkId");

-- CreateIndex
CREATE INDEX "CdkRedemption_createdAt_idx" ON "CdkRedemption"("createdAt");

-- CreateIndex
CREATE INDEX "EmailCodeRequest_sourceType_idx" ON "EmailCodeRequest"("sourceType");

-- CreateIndex
CREATE INDEX "EmailCodeRequest_status_idx" ON "EmailCodeRequest"("status");

-- CreateIndex
CREATE INDEX "EmailCodeRequest_createdAt_idx" ON "EmailCodeRequest"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitBucket_key_key" ON "RateLimitBucket"("key");
