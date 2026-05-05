import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;
  const logs = await prisma.auditLog.findMany({
    include: { actor: { select: { email: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ data: logs });
}
