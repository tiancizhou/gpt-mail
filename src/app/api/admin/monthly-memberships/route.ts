import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/session";
import { writeAuditLog } from "@/server/security/auditLog";
import { getIpHash, getUserAgent } from "@/server/security/request";
import { createMonthlyMembership, listMonthlyMemberships } from "@/server/services/monthlyMembershipService";
import { monthlyMembershipSchema } from "@/server/validators/schemas";

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;
  return NextResponse.json({ data: await listMonthlyMemberships() });
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;
  const body = monthlyMembershipSchema.parse(await request.json());
  const membership = await createMonthlyMembership({ ...body, startsAt: new Date(body.startsAt), endsAt: new Date(body.endsAt) });
  await writeAuditLog({ actorUserId: user!.id, action: "MONTHLY_MEMBER_ASSIGNED", entityType: "MonthlyMembership", entityId: membership.id, ipHash: getIpHash(request), userAgent: getUserAgent(request) });
  return NextResponse.json({ data: membership });
}
