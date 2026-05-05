import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/session";
import { testDomainEmailToken } from "@/server/email/domainEmailClient";

export async function POST(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;
  await testDomainEmailToken();
  return NextResponse.json({ ok: true });
}
