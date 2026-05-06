import "dotenv/config";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@libsql/client";
import { hashPassword } from "../src/server/auth/password";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(__dirname, "dev.db");

async function main() {
  const db = createClient({ url: `file:${dbPath}` });
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;

  if (!email || !password) {
    throw new Error("ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD are required");
  }

  const existing = await db.execute({ sql: "SELECT id FROM User WHERE email = ?", args: [email] });

  if (existing.rows.length > 0) {
    await db.execute({
      sql: "UPDATE User SET passwordHash = ?, role = 'ADMIN', updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE email = ?",
      args: [await hashPassword(password), email],
    });
    console.log("Admin user updated.");
  } else {
    const id = crypto.randomUUID();
    await db.execute({
      sql: "INSERT INTO User (id, email, passwordHash, role, name, status, createdAt, updatedAt) VALUES (?, ?, ?, 'ADMIN', '管理员', 'ACTIVE', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
      args: [id, email, await hashPassword(password)],
    });
    console.log("Admin user created.");
  }

  await db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
