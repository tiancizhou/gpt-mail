import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/session";
import { addDomainEmailUser } from "@/server/email/domainEmailClient";
import { addEmailUserSchema } from "@/server/validators/schemas";

export async function POST(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;
  const body = addEmailUserSchema.parse(await request.json());
  await addDomainEmailUser(body);
  return NextResponse.json({ ok: true });
}
