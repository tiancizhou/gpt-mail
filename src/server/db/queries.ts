import "server-only";

import { db } from "@/server/db/db";
import { listGptAccounts } from "@/server/services/gptAccountService";
import { listMonthlyMemberships } from "@/server/services/monthlyMembershipService";

type AccountOption = { id: string; label: string; loginEmail: string };
type CdkListItem = {
  id: string;
  code: string | null;
  displayCodeLast4: string;
  durationDays: number;
  maxUses: number;
  remainingUses: number;
  status: string;
  validUntil: string | null;
  redeemedByFingerprint: string | null;
  gptAccount: AccountOption;
  redeemedByUser: { id: string; email: string; wechatName: string | null; name: string | null } | null;
};
type CdkEmailRequestItem = {
  id: string;
  status: string;
  verificationCodeMasked: string | null;
  createdAt: string;
  gptAccount: AccountOption;
  cdk: {
    id: string;
    code: string | null;
    displayCodeLast4: string;
    redeemedByFingerprint: string | null;
    redeemedByUser: { id: string; email: string; wechatName: string | null; name: string | null } | null;
  } | null;
};

export async function listActiveGptAccountOptions(): Promise<AccountOption[]> {
  const result = await db.execute("SELECT id, label, loginEmail FROM GptAccount WHERE status != 'ARCHIVED' ORDER BY createdAt DESC");
  return result.rows.map((row) => ({ id: row.id as string, label: row.label as string, loginEmail: row.loginEmail as string }));
}

export async function listGptAccountsForAdmin() {
  return listGptAccounts();
}

export async function listMembershipsForAdmin() {
  return listMonthlyMemberships();
}

export async function listCdksForAdmin(limit = 100): Promise<CdkListItem[]> {
  const result = await db.execute({
    sql: "SELECT Cdk.*, g.id as g_id, g.label as g_label, g.loginEmail as g_loginEmail, u.id as u_id, u.email as u_email, u.wechatName as u_wechatName, u.name as u_name FROM Cdk JOIN GptAccount g ON Cdk.gptAccountId = g.id LEFT JOIN User u ON Cdk.redeemedByUserId = u.id ORDER BY Cdk.createdAt DESC LIMIT ?",
    args: [limit],
  });
  return result.rows.map((row) => ({
    id: row.id as string,
    code: row.code as string | null,
    displayCodeLast4: row.displayCodeLast4 as string,
    durationDays: row.durationDays as number,
    maxUses: row.maxUses as number,
    remainingUses: row.remainingUses as number,
    status: row.status as string,
    validUntil: row.validUntil as string | null,
    redeemedByFingerprint: row.redeemedByFingerprint as string | null,
    gptAccount: { id: row.g_id as string, label: row.g_label as string, loginEmail: row.g_loginEmail as string },
    redeemedByUser: row.u_id ? { id: row.u_id as string, email: row.u_email as string, wechatName: row.u_wechatName as string | null, name: row.u_name as string | null } : null,
  }));
}

export async function listCdkEmailRequests(limit = 100): Promise<CdkEmailRequestItem[]> {
  const result = await db.execute({
    sql: "SELECT e.*, g.id as g_id, g.label as g_label, g.loginEmail as g_loginEmail, c.id as c_id, c.code as c_code, c.displayCodeLast4 as c_displayCodeLast4, c.redeemedByFingerprint as c_redeemedByFingerprint, u.id as u_id, u.email as u_email, u.wechatName as u_wechatName, u.name as u_name FROM EmailCodeRequest e JOIN GptAccount g ON e.gptAccountId = g.id LEFT JOIN Cdk c ON e.cdkId = c.id LEFT JOIN User u ON c.redeemedByUserId = u.id WHERE e.sourceType = 'CDK' ORDER BY e.createdAt DESC LIMIT ?",
    args: [limit],
  });
  return result.rows.map((row) => ({
    id: row.id as string,
    status: row.status as string,
    verificationCodeMasked: row.verificationCodeMasked as string | null,
    createdAt: row.createdAt as string,
    gptAccount: { id: row.g_id as string, label: row.g_label as string, loginEmail: row.g_loginEmail as string },
    cdk: row.c_id ? {
      id: row.c_id as string,
      code: row.c_code as string | null,
      displayCodeLast4: row.c_displayCodeLast4 as string,
      redeemedByFingerprint: row.c_redeemedByFingerprint as string | null,
      redeemedByUser: row.u_id ? { id: row.u_id as string, email: row.u_email as string, wechatName: row.u_wechatName as string | null, name: row.u_name as string | null } : null,
    } : null,
  }));
}

export async function countSuccessfulMonthlyRequestsSince(userId: string, gptAccountId: string, since: Date) {
  const result = await db.execute({
    sql: "SELECT COUNT(*) as cnt FROM EmailCodeRequest WHERE userId = ? AND gptAccountId = ? AND sourceType = 'MONTHLY' AND status = 'SUCCESS' AND createdAt >= ?",
    args: [userId, gptAccountId, since.toISOString()],
  });
  return result.rows[0].cnt as number;
}
