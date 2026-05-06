import "server-only";

import { db, generateId } from "@/server/db/db";

export async function checkRateLimit(key: string, limit: number, windowSeconds: number) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowSeconds * 1000);

  const result = await db.execute({ sql: "SELECT windowStart, count FROM RateLimitBucket WHERE key = ?", args: [key] });
  const row = result.rows[0];

  if (!row || new Date(row.windowStart as string) < windowStart) {
    await db.execute({
      sql: "INSERT INTO RateLimitBucket (id, key, windowStart, count, createdAt, updatedAt) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(key) DO UPDATE SET windowStart = strftime('%Y-%m-%dT%H:%M:%fZ','now'), count = 1, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now')",
      args: [generateId(), key],
    });
    return { allowed: true, remaining: limit - 1 };
  }

  const count = row.count as number;
  if (count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  await db.execute({
    sql: "UPDATE RateLimitBucket SET count = count + 1, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE key = ?",
    args: [key],
  });

  return { allowed: true, remaining: Math.max(0, limit - count - 1) };
}
