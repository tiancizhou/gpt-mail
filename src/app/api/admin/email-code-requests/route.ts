import { EmailCodeSourceType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;
  const cdkId = request.nextUrl.searchParams.get("cdkId");
  const requests = await prisma.emailCodeRequest.findMany({
    where: { sourceType: EmailCodeSourceType.CDK, cdkId: cdkId || undefined },
    include: { gptAccount: true, cdk: { include: { redeemedByUser: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ data: requests });
}
