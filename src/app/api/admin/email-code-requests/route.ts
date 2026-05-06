import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/server/db/db";

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;
  const cdkId = request.nextUrl.searchParams.get("cdkId");
  const result = await db.execute({
    sql: "SELECT e.*, g.id as g_id, g.label as g_label, g.loginEmail as g_loginEmail, c.id as c_id, c.code as c_code, c.displayCodeLast4 as c_displayCodeLast4, c.redeemedByFingerprint as c_redeemedByFingerprint, u.id as u_id, u.email as u_email, u.wechatName as u_wechatName, u.name as u_name FROM EmailCodeRequest e JOIN GptAccount g ON e.gptAccountId = g.id LEFT JOIN Cdk c ON e.cdkId = c.id LEFT JOIN User u ON c.redeemedByUserId = u.id WHERE e.sourceType = 'CDK'" + (cdkId ? " AND e.cdkId = ?" : "") + " ORDER BY e.createdAt DESC LIMIT 100",
    args: cdkId ? [cdkId] : [],
  });
  const requests = result.rows.map((row) => ({
    id: row.id,
    sourceType: row.sourceType,
    userId: row.userId,
    cdkId: row.cdkId,
    gptAccountId: row.gptAccountId,
    targetEmail: row.targetEmail,
    status: row.status,
    verificationCodeMasked: row.verificationCodeMasked,
    providerMessageId: row.providerMessageId,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    gptAccount: { id: row.g_id, label: row.g_label, loginEmail: row.g_loginEmail },
    cdk: row.c_id ? {
      id: row.c_id,
      code: row.c_code,
      displayCodeLast4: row.c_displayCodeLast4,
      redeemedByFingerprint: row.c_redeemedByFingerprint,
      redeemedByUser: row.u_id ? { id: row.u_id, email: row.u_email, wechatName: row.u_wechatName, name: row.u_name } : null,
    } : null,
  }));
  return NextResponse.json({ data: requests });
}
