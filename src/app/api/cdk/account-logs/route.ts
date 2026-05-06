import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/db";
import { checkRateLimit } from "@/server/security/rateLimit";
import { getIpHash } from "@/server/security/request";
import { cdkAccountLogsSchema } from "@/server/validators/schemas";

const emptyData = { account: null, cdks: [], recentRequests: [] };

export async function POST(request: NextRequest) {
  const ipHash = getIpHash(request);
  const limited = await checkRateLimit(`cdk-account-logs:${ipHash}`, 10, 60);
  if (!limited.allowed) return NextResponse.json({ error: "查询过于频繁，请稍后再试" }, { status: 429 });

  try {
    const body = cdkAccountLogsSchema.parse(await request.json());
    const email = body.email.trim().toLowerCase();

    const accountResult = await db.execute({
      sql: "SELECT id, loginEmail FROM GptAccount WHERE lower(loginEmail) = ? AND status != 'ARCHIVED' LIMIT 1",
      args: [email],
    });
    const account = accountResult.rows[0];
    if (!account) return NextResponse.json({ data: emptyData });

    const accountId = account.id as string;
    const [cdksResult, requestsResult] = await Promise.all([
      db.execute({
        sql: "SELECT c.displayCodeLast4, c.status, c.remainingUses, c.maxUses, c.activatedAt, c.validUntil, u.wechatName, u.name, (SELECT COUNT(*) FROM EmailCodeRequest e WHERE e.sourceType = 'CDK' AND e.cdkId = c.id AND e.status = 'SUCCESS') AS successRequestCount, (SELECT COUNT(*) FROM EmailCodeRequest e WHERE e.sourceType = 'CDK' AND e.cdkId = c.id) AS totalRequestCount FROM Cdk c LEFT JOIN User u ON c.redeemedByUserId = u.id WHERE c.gptAccountId = ? ORDER BY CASE c.status WHEN 'ACTIVE' THEN 0 WHEN 'UNUSED' THEN 1 WHEN 'EXHAUSTED' THEN 2 WHEN 'EXPIRED' THEN 3 WHEN 'REVOKED' THEN 4 ELSE 5 END, c.createdAt DESC LIMIT 50",
        args: [accountId],
      }),
      db.execute({
        sql: "SELECT e.status, e.createdAt, e.completedAt, c.displayCodeLast4, u.wechatName, u.name FROM EmailCodeRequest e LEFT JOIN Cdk c ON e.cdkId = c.id LEFT JOIN User u ON c.redeemedByUserId = u.id WHERE e.sourceType = 'CDK' AND e.gptAccountId = ? ORDER BY e.createdAt DESC LIMIT 30",
        args: [accountId],
      }),
    ]);

    return NextResponse.json({
      data: {
        account: { loginEmail: account.loginEmail as string },
        cdks: cdksResult.rows.map((row) => ({
          displayCodeLast4: row.displayCodeLast4 as string,
          status: row.status as string,
          remainingUses: row.remainingUses as number,
          maxUses: row.maxUses as number,
          activatedAt: row.activatedAt as string | null,
          validUntil: row.validUntil as string | null,
          wechatName: (row.wechatName || row.name || null) as string | null,
          successRequestCount: Number(row.successRequestCount || 0),
          totalRequestCount: Number(row.totalRequestCount || 0),
        })),
        recentRequests: requestsResult.rows.map((row) => ({
          displayCodeLast4: row.displayCodeLast4 as string | null,
          wechatName: (row.wechatName || row.name || null) as string | null,
          status: row.status as string,
          createdAt: row.createdAt as string,
          completedAt: row.completedAt as string | null,
        })),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "查询失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
