import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "../src/server/auth/password";

const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
const sqlitePath = databaseUrl.startsWith("file:") ? databaseUrl.slice(5) : databaseUrl;
const adapter = new PrismaBetterSqlite3({ url: sqlitePath });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;

  if (!email || !password) {
    throw new Error("ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD are required");
  }

  await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash: await hashPassword(password),
      role: UserRole.ADMIN,
    },
    create: {
      email,
      passwordHash: await hashPassword(password),
      role: UserRole.ADMIN,
      name: "管理员",
    },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    process.exit(1);
  });
