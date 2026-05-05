import "server-only";

import { CdkStatus, MembershipStatus, UserRole } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { hashPassword } from "@/server/auth/password";
import { sha256 } from "@/server/security/encryption";

function normalizeCdkCode(code: string) {
  return code.trim().toUpperCase();
}

function hashCdkCode(code: string) {
  return sha256(normalizeCdkCode(code));
}

function userEmailFromWechatName(wechatName: string) {
  return `${sha256(wechatName).slice(0, 16)}@wechat.local`;
}

export async function listMonthlyMemberships() {
  return prisma.monthlyMembership.findMany({
    include: { user: true, gptAccount: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createMonthlyMembership(input: {
  wechatName: string;
  cdkCode?: string;
  gptAccountId: string;
  startsAt: Date;
  endsAt: Date;
  requestLimitPerDay: number;
}) {
  if (input.endsAt <= input.startsAt) {
    throw new Error("结束时间必须晚于开始时间");
  }

  return prisma.$transaction(async (tx) => {
    const account = await tx.gptAccount.findUnique({ where: { id: input.gptAccountId } });
    if (!account) throw new Error("GPT 账号不存在");

    const activeCount = await tx.monthlyMembership.count({
      where: {
        gptAccountId: input.gptAccountId,
        status: MembershipStatus.ACTIVE,
        endsAt: { gt: new Date() },
      },
    });

    if (activeCount >= account.capacity) {
      throw new Error("这个 GPT 账号车位已满");
    }

    const user = await tx.user.upsert({
      where: { email: userEmailFromWechatName(input.wechatName) },
      update: {
        wechatName: input.wechatName,
        name: input.wechatName,
      },
      create: {
        email: userEmailFromWechatName(input.wechatName),
        wechatName: input.wechatName,
        name: input.wechatName,
        passwordHash: await hashPassword(crypto.randomUUID()),
        role: UserRole.USER,
      },
    });

    if (input.cdkCode) {
      const cdk = await tx.cdk.findUnique({ where: { codeHash: hashCdkCode(input.cdkCode) } });
      if (!cdk) throw new Error("CDK 不存在");
      if (cdk.status === CdkStatus.REVOKED || cdk.status === CdkStatus.EXHAUSTED || cdk.status === CdkStatus.EXPIRED) {
        throw new Error("CDK 当前不可绑定");
      }
      await tx.cdk.update({
        where: { id: cdk.id },
        data: {
          redeemedByUserId: user.id,
          redeemedByFingerprint: input.wechatName,
        },
      });
    }

    return tx.monthlyMembership.create({
      data: {
        userId: user.id,
        gptAccountId: input.gptAccountId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        requestLimitPerDay: input.requestLimitPerDay,
      },
      include: { user: true, gptAccount: true },
    });
  });
}

export async function getActiveUserMembership(userId: string, gptAccountId: string) {
  const now = new Date();
  return prisma.monthlyMembership.findFirst({
    where: {
      userId,
      gptAccountId,
      status: MembershipStatus.ACTIVE,
      startsAt: { lte: now },
      endsAt: { gt: now },
    },
    include: { gptAccount: true },
  });
}

export async function getUserMemberships(userId: string) {
  const now = new Date();
  return prisma.monthlyMembership.findMany({
    where: {
      userId,
      status: MembershipStatus.ACTIVE,
      startsAt: { lte: now },
      endsAt: { gt: now },
    },
    include: { gptAccount: true },
    orderBy: { endsAt: "asc" },
  });
}
