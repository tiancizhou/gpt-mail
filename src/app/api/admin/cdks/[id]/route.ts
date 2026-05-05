import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/session";
import { writeAuditLog } from "@/server/security/auditLog";
import { getIpHash, getUserAgent } from "@/server/security/request";
import { deleteCdk } from "@/server/services/cdkService";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: Params) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;
  const { id } = await context.params;
  const cdk = await deleteCdk(id);
  await writeAuditLog({ actorUserId: user!.id, action: "CDK_DELETED", entityType: "Cdk", entityId: id, ipHash: getIpHash(request), userAgent: getUserAgent(request) });
  return NextResponse.json({ data: cdk });
}
