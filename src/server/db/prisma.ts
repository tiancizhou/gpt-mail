import "server-only";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
const sqlitePath = databaseUrl.startsWith("file:") ? databaseUrl.slice(5) : databaseUrl;
const adapter = new PrismaBetterSqlite3({ url: sqlitePath });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
