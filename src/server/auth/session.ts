import "server-only";

import { UserRole, UserStatus } from "@prisma/client";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/server/config/env";
import { prisma } from "@/server/db/prisma";

const sessionCookieName = "gpt_mail_session";
const secret = new TextEncoder().encode(env.SESSION_SECRET);

export type SessionUser = {
  id: string;
  email: string;
  role: UserRole;
  name: string | null;
};

export async function createSessionToken(user: SessionUser) {
  return new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function setSessionCookie(response: NextResponse, user: SessionUser) {
  const token = await createSessionToken(user);
  response.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionUserFromToken(token?: string): Promise<SessionUser | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    const id = typeof payload.id === "string" ? payload.id : null;
    if (!id) return null;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.status !== UserStatus.ACTIVE) return null;

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  return getSessionUserFromToken(cookieStore.get(sessionCookieName)?.value);
}

export async function getRequestUser(request: NextRequest) {
  return getSessionUserFromToken(request.cookies.get(sessionCookieName)?.value);
}

export async function requireUser(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return { user: null, response: NextResponse.json({ error: "请先登录" }, { status: 401 }) };
  }
  return { user, response: null };
}

export async function requireAdmin(request: NextRequest) {
  const result = await requireUser(request);
  if (result.response) return result;
  if (result.user?.role !== UserRole.ADMIN) {
    return { user: null, response: NextResponse.json({ error: "需要管理员权限" }, { status: 403 }) };
  }
  return result;
}
