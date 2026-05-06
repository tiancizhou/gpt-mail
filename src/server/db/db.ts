import "server-only";

import { createClient, type Client } from "@libsql/client";

const globalForDb = globalThis as unknown as { db?: Client };

export const db = globalForDb.db ?? createClient({ url: process.env.DATABASE_URL || "file:./prisma/dev.db" });

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}

export function generateId() {
  return crypto.randomUUID();
}
