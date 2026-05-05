import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/server/security/rateLimit";
import { getIpHash } from "@/server/security/request";
import { redeemCdk } from "@/server/services/cdkService";
import { cdkCodeSchema } from "@/server/validators/schemas";

export async function POST(request: NextRequest) {
  const ipHash = getIpHash(request);
  const limited = await checkRateLimit(`cdk-redeem:${ipHash}`, 20, 60);
  if (!limited.allowed) return NextResponse.json({ error: "操作过于频繁，请稍后再试" }, { status: 429 });

  try {
    const body = cdkCodeSchema.parse(await request.json());
    const data = await redeemCdk(body.code, ipHash);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "兑换失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
