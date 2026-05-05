import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/server/security/rateLimit";
import { getIpHash, getUserAgent } from "@/server/security/request";
import { requestCodeByCdk } from "@/server/services/cdkService";
import { cdkCodeSchema } from "@/server/validators/schemas";

export async function POST(request: NextRequest) {
  const ipHash = getIpHash(request);
  const limited = await checkRateLimit(`cdk-code:${ipHash}`, 5, 60);
  if (!limited.allowed) return NextResponse.json({ error: "取码过于频繁，请稍后再试" }, { status: 429 });

  try {
    const body = cdkCodeSchema.parse(await request.json());
    const data = await requestCodeByCdk({ code: body.code, ipHash, userAgent: getUserAgent(request) });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "取码失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
