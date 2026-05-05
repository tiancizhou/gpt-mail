import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/session";
import { getUserMemberships } from "@/server/services/monthlyMembershipService";

export async function GET(request: NextRequest) {
  const { user, response } = await requireUser(request);
  if (response) return response;
  const memberships = await getUserMemberships(user!.id);
  return NextResponse.json({
    data: memberships.map((membership) => ({
      id: membership.id,
      endsAt: membership.endsAt,
      requestLimitPerDay: membership.requestLimitPerDay,
      gptAccount: {
        id: membership.gptAccount.id,
        label: membership.gptAccount.label,
        loginEmail: membership.gptAccount.loginEmail,
      },
    })),
  });
}
