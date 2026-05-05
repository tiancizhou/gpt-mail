import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/session";
import { writeAuditLog } from "@/server/security/auditLog";
import { getIpHash, getUserAgent } from "@/server/security/request";
import { createGptAccount, listGptAccounts } from "@/server/services/gptAccountService";
import { gptAccountSchema } from "@/server/validators/schemas";

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;
  return NextResponse.json({ data: await listGptAccounts() });
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;

  const body = gptAccountSchema.parse(await request.json());
  const account = await createGptAccount(body);
  await writeAuditLog({ actorUserId: user!.id, action: "GPT_ACCOUNT_CREATED", entityType: "GptAccount", entityId: account.id, ipHash: getIpHash(request), userAgent: getUserAgent(request) });
  return NextResponse.json({ data: account });
}
