import { GptAccountStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/session";
import { writeAuditLog } from "@/server/security/auditLog";
import { getIpHash, getUserAgent } from "@/server/security/request";
import { archiveGptAccount, updateGptAccount } from "@/server/services/gptAccountService";
import { gptAccountUpdateSchema } from "@/server/validators/schemas";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Params) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;
  const { id } = await context.params;
  const body = gptAccountUpdateSchema.parse(await request.json());
  const account = await updateGptAccount(id, { ...body, status: body.status as GptAccountStatus | undefined });
  await writeAuditLog({ actorUserId: user!.id, action: "GPT_ACCOUNT_UPDATED", entityType: "GptAccount", entityId: id, ipHash: getIpHash(request), userAgent: getUserAgent(request) });
  return NextResponse.json({ data: account });
}

export async function DELETE(request: NextRequest, context: Params) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;
  const { id } = await context.params;
  const account = await archiveGptAccount(id);
  await writeAuditLog({ actorUserId: user!.id, action: "GPT_ACCOUNT_ARCHIVED", entityType: "GptAccount", entityId: id, ipHash: getIpHash(request), userAgent: getUserAgent(request) });
  return NextResponse.json({ data: account });
}
