import { UserStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { verifyPassword } from "@/server/auth/password";
import { setSessionCookie } from "@/server/auth/session";
import { checkRateLimit } from "@/server/security/rateLimit";
import { getIpHash, getUserAgent } from "@/server/security/request";
import { writeAuditLog } from "@/server/security/auditLog";
import { loginSchema } from "@/server/validators/schemas";

export async function POST(request: NextRequest) {
  const ipHash = getIpHash(request);
  const limited = await checkRateLimit(`login:${ipHash}`, 10, 60);
  if (!limited.allowed) return NextResponse.json({ error: "登录尝试过多，请稍后再试" }, { status: 429 });

  const body = loginSchema.parse(await request.json());
  const user = await prisma.user.findUnique({ where: { email: body.email } });

  if (!user || user.status !== UserStatus.ACTIVE || !(await verifyPassword(body.password, user.passwordHash))) {
    return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await writeAuditLog({ actorUserId: user.id, action: "LOGIN", ipHash, userAgent: getUserAgent(request) });

  const response = NextResponse.json({ user: { id: user.id, email: user.email, role: user.role, name: user.name } });
  await setSessionCookie(response, { id: user.id, email: user.email, role: user.role, name: user.name });
  return response;
}
