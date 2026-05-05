import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/server/auth/session";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  return NextResponse.json({ user });
}
