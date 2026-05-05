import "server-only";

import { randomBytes } from "crypto";
import { CdkRedemptionStatus, CdkStatus, EmailCodeRequestStatus, EmailCodeSourceType } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { sha256 } from "@/server/security/encryption";
import { fetchVerificationCode } from "@/server/services/emailCodeService";
import { createMonthlyMembership } from "@/server/services/monthlyMembershipService";

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function hashCode(code: string) {
  return sha256(normalizeCode(code));
}

function generateCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(12);
  const chars = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]);
  return `GM-${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}`;
}

function publicCdk(cdk: { code?: string | null; status: CdkStatus; durationDays: number; maxUses: number; remainingUses: number; validUntil: Date | null; displayCodeLast4: string }) {
  return {
    code: cdk.code,
    status: cdk.status,
    durationDays: cdk.durationDays,
    maxUses: cdk.maxUses,
    remainingUses: cdk.remainingUses,
    validUntil: cdk.validUntil,
    displayCodeLast4: cdk.displayCodeLast4,
  };
}

export async function listCdks() {
  return prisma.cdk.findMany({
    include: { gptAccount: true, createdByAdmin: true, redeemedByUser: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createCdkWithSeat(input: {
  wechatName: string;
  durationDays: number;
  gptAccountId: string;
  adminId: string;
  startsAt: Date;
  endsAt: Date;
  requestLimitPerDay: number;
}) {
  const code = generateCode();

  const cdk = await prisma.cdk.create({
    data: {
      codeHash: hashCode(code),
      code,
      displayCodeLast4: code.slice(-4),
      durationDays: input.durationDays,
      maxUses: input.durationDays,
      remainingUses: input.durationDays,
      gptAccountId: input.gptAccountId,
      createdByAdminId: input.adminId,
    },
  });

  const membership = await createMonthlyMembership({
    wechatName: input.wechatName,
    cdkCode: code,
    gptAccountId: input.gptAccountId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    requestLimitPerDay: input.requestLimitPerDay,
  });

  return { cdk: { ...cdk, code }, membership };
}

export async function redeemCdk(code: string, fingerprint?: string) {
  const codeHash = hashCode(code);
  const now = new Date();

  const cdk = await prisma.$transaction(async (tx) => {
    const existing = await tx.cdk.findUnique({ where: { codeHash } });
    if (!existing) throw new Error("CDK 不存在或已失效");
    if (existing.status === CdkStatus.REVOKED) throw new Error("CDK 已作废");
    if (existing.status === CdkStatus.EXHAUSTED) throw new Error("CDK 次数已用完");
    if (existing.validUntil && existing.validUntil <= now) {
      return tx.cdk.update({ where: { id: existing.id }, data: { status: CdkStatus.EXPIRED } });
    }

    if (existing.status === CdkStatus.UNUSED) {
      return tx.cdk.update({
        where: { id: existing.id },
        data: {
          status: CdkStatus.ACTIVE,
          activatedAt: now,
          validUntil: new Date(now.getTime() + existing.durationDays * 24 * 60 * 60 * 1000),
          redeemedByFingerprint: fingerprint,
        },
      });
    }

    return existing;
  });

  if (cdk.status === CdkStatus.EXPIRED) throw new Error("CDK 已过期");
  return publicCdk(cdk);
}

export async function requestCodeByCdk(input: { code: string; ipHash?: string; userAgent?: string }) {
  const codeHash = hashCode(input.code);
  const now = new Date();

  const pending = await prisma.$transaction(async (tx) => {
    const cdk = await tx.cdk.findUnique({ where: { codeHash }, include: { gptAccount: true } });
    if (!cdk) throw new Error("CDK 不存在或已失效");
    if (cdk.status === CdkStatus.REVOKED) throw new Error("CDK 已作废");
    if (cdk.status === CdkStatus.EXHAUSTED) throw new Error("CDK 次数已用完");
    if (cdk.validUntil && cdk.validUntil <= now) {
      await tx.cdk.update({ where: { id: cdk.id }, data: { status: CdkStatus.EXPIRED } });
      throw new Error("CDK 已过期");
    }
    if (cdk.remainingUses <= 0) throw new Error("CDK 次数已用完");

    const request = await tx.emailCodeRequest.create({
      data: {
        sourceType: EmailCodeSourceType.CDK,
        cdkId: cdk.id,
        gptAccountId: cdk.gptAccountId,
        targetEmail: cdk.gptAccount.loginEmail,
        status: EmailCodeRequestStatus.PENDING,
      },
    });

    return { cdk, request };
  });

  try {
    const result = await fetchVerificationCode({
      requestId: pending.request.id,
      sourceType: EmailCodeSourceType.CDK,
      gptAccountId: pending.cdk.gptAccountId,
      targetEmail: pending.cdk.gptAccount.loginEmail,
      startedAt: now,
    });

    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.cdk.findUnique({ where: { id: pending.cdk.id }, include: { gptAccount: true } });
      if (!current) throw new Error("CDK 不存在或已失效");
      if (current.status === CdkStatus.REVOKED) throw new Error("CDK 已作废");
      if (current.validUntil && current.validUntil <= new Date()) {
        await tx.cdk.update({ where: { id: current.id }, data: { status: CdkStatus.EXPIRED } });
        throw new Error("CDK 已过期");
      }
      if (current.remainingUses <= 0) throw new Error("CDK 次数已用完");

      const activatedAt = current.activatedAt ?? now;
      const validUntil = current.validUntil ?? new Date(now.getTime() + current.durationDays * 24 * 60 * 60 * 1000);
      const nextRemainingUses = current.remainingUses - 1;

      const cdk = await tx.cdk.update({
        where: { id: current.id },
        data: {
          status: nextRemainingUses === 0 ? CdkStatus.EXHAUSTED : CdkStatus.ACTIVE,
          activatedAt,
          validUntil,
          remainingUses: nextRemainingUses,
        },
        include: { gptAccount: true },
      });

      await tx.cdkRedemption.create({
        data: {
          cdkId: cdk.id,
          ipHash: input.ipHash,
          userAgent: input.userAgent,
          status: CdkRedemptionStatus.SUCCESS,
          emailCodeRequestId: pending.request.id,
        },
      });

      return cdk;
    });

    return { ...result, cdk: publicCdk(updated) };
  } catch (error) {
    await prisma.cdkRedemption.create({
      data: {
        cdkId: pending.cdk.id,
        ipHash: input.ipHash,
        userAgent: input.userAgent,
        status: CdkRedemptionStatus.FAILED,
        failureReason: error instanceof Error ? error.message : "取码失败",
        emailCodeRequestId: pending.request.id,
      },
    });

    throw error;
  }
}

export async function revokeCdk(id: string) {
  return prisma.cdk.update({ where: { id }, data: { status: CdkStatus.REVOKED } });
}

export async function deleteCdk(id: string) {
  return prisma.$transaction(async (tx) => {
    await tx.cdkRedemption.deleteMany({ where: { cdkId: id } });
    await tx.emailCodeRequest.updateMany({ where: { cdkId: id }, data: { cdkId: null } });
    return tx.cdk.delete({ where: { id } });
  });
}
