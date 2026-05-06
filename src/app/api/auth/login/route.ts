import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/db";
import type { UserRole } from "@/server/db/types";
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
  const result = await db.execute({ sql: "SELECT * FROM User WHERE email = ?", args: [body.email] });
  const user = result.rows[0];

  if (!user || user.status !== "ACTIVE" || !(await verifyPassword(body.password, user.passwordHash as string))) {
    return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
  }

  await db.execute({ sql: "UPDATE User SET lastLoginAt = strftime('%Y-%m-%dT%H:%M:%fZ','now'), updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", args: [user.id] });
  await writeAuditLog({ actorUserId: user.id as string, action: "LOGIN", ipHash, userAgent: getUserAgent(request) });

  const sessionUser = { id: user.id as string, email: user.email as string, role: user.role as UserRole, name: user.name as string | null };
  const response = NextResponse.json({ user: sessionUser });
  await setSessionCookie(response, sessionUser);
  return response;
}
