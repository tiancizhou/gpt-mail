import { EmailCodeRequestStatus, EmailCodeSourceType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { checkRateLimit } from "@/server/security/rateLimit";
import { getIpHash } from "@/server/security/request";
import { fetchVerificationCode } from "@/server/services/emailCodeService";
import { getActiveUserMembership } from "@/server/services/monthlyMembershipService";
import { monthlyRequestCodeSchema } from "@/server/validators/schemas";

export async function POST(request: NextRequest) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  const ipHash = getIpHash(request);
  const limited = await checkRateLimit(`monthly-code:${user!.id}:${ipHash}`, 5, 60);
  if (!limited.allowed) return NextResponse.json({ error: "取码过于频繁，请稍后再试" }, { status: 429 });

  const body = monthlyRequestCodeSchema.parse(await request.json());
  const membership = await getActiveUserMembership(user!.id, body.gptAccountId);
  if (!membership) return NextResponse.json({ error: "没有这个账号的有效车位" }, { status: 403 });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const usedToday = await prisma.emailCodeRequest.count({
    where: {
      userId: user!.id,
      gptAccountId: body.gptAccountId,
      sourceType: EmailCodeSourceType.MONTHLY,
      status: EmailCodeRequestStatus.SUCCESS,
      createdAt: { gte: todayStart },
    },
  });
  if (usedToday >= membership.requestLimitPerDay) {
    return NextResponse.json({ error: "今天取码次数已用完" }, { status: 429 });
  }

  const requestRecord = await prisma.emailCodeRequest.create({
    data: {
      sourceType: EmailCodeSourceType.MONTHLY,
      userId: user!.id,
      gptAccountId: membership.gptAccountId,
      targetEmail: membership.gptAccount.loginEmail,
      status: EmailCodeRequestStatus.PENDING,
    },
  });

  const data = await fetchVerificationCode({
    requestId: requestRecord.id,
    sourceType: EmailCodeSourceType.MONTHLY,
    gptAccountId: membership.gptAccountId,
    targetEmail: membership.gptAccount.loginEmail,
    startedAt: requestRecord.createdAt,
  });

  return NextResponse.json({ data });
}
