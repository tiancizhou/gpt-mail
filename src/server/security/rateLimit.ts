import "server-only";

import { prisma } from "@/server/db/prisma";

export async function checkRateLimit(key: string, limit: number, windowSeconds: number) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowSeconds * 1000);
  const bucket = await prisma.rateLimitBucket.findUnique({ where: { key } });

  if (!bucket || bucket.windowStart < windowStart) {
    await prisma.rateLimitBucket.upsert({
      where: { key },
      update: { windowStart: now, count: 1 },
      create: { key, windowStart: now, count: 1 },
    });
    return { allowed: true, remaining: limit - 1 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  const updated = await prisma.rateLimitBucket.update({
    where: { key },
    data: { count: { increment: 1 } },
  });

  return { allowed: true, remaining: Math.max(0, limit - updated.count) };
}
