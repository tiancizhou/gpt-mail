import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/session";
import { db, generateId } from "@/server/db/db";
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
  const usedResult = await db.execute({
    sql: "SELECT COUNT(*) as cnt FROM EmailCodeRequest WHERE userId = ? AND gptAccountId = ? AND sourceType = 'MONTHLY' AND status = 'SUCCESS' AND createdAt >= ?",
    args: [user!.id, body.gptAccountId, todayStart.toISOString()],
  });
  const usedToday = usedResult.rows[0].cnt as number;
  if (usedToday >= membership.requestLimitPerDay) {
    return NextResponse.json({ error: "今天取码次数已用完" }, { status: 429 });
  }

  const requestId = generateId();
  await db.execute({
    sql: "INSERT INTO EmailCodeRequest (id, sourceType, userId, gptAccountId, targetEmail, status, createdAt) VALUES (?, 'MONTHLY', ?, ?, ?, 'PENDING', strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
    args: [requestId, user!.id, membership.gptAccountId, membership.gptAccount.loginEmail],
  });
  const requestResult = await db.execute({ sql: "SELECT createdAt FROM EmailCodeRequest WHERE id = ?", args: [requestId] });

  const data = await fetchVerificationCode({
    requestId,
    sourceType: "MONTHLY",
    gptAccountId: membership.gptAccountId,
    targetEmail: membership.gptAccount.loginEmail,
    startedAt: new Date(requestResult.rows[0].createdAt as string),
  });

  return NextResponse.json({ data });
}
