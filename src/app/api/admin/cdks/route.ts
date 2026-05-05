import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/session";
import { writeAuditLog } from "@/server/security/auditLog";
import { getIpHash, getUserAgent } from "@/server/security/request";
import { createCdkWithSeat, listCdks } from "@/server/services/cdkService";
import { createCdkSchema } from "@/server/validators/schemas";

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;
  return NextResponse.json({ data: await listCdks() });
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;
  const body = createCdkSchema.parse(await request.json());
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + body.durationDays * 24 * 60 * 60 * 1000);
  const result = await createCdkWithSeat({
    ...body,
    startsAt,
    endsAt,
    adminId: user!.id,
  });
  await writeAuditLog({ actorUserId: user!.id, action: "CDK_CREATED_WITH_SEAT", entityType: "Cdk", entityId: result.cdk.id, metadata: { wechatName: body.wechatName, durationDays: body.durationDays, gptAccountId: body.gptAccountId }, ipHash: getIpHash(request), userAgent: getUserAgent(request) });
  return NextResponse.json({ data: result });
}
