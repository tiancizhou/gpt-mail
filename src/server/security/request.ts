import "server-only";

import { NextRequest } from "next/server";
import { sha256 } from "@/server/security/encryption";

export function getClientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function getIpHash(request: NextRequest) {
  return sha256(getClientIp(request));
}

export function getUserAgent(request: NextRequest) {
  return request.headers.get("user-agent") || "unknown";
}
