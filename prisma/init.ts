import "dotenv/config";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@libsql/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(__dirname, "dev.db");

async function main() {
  const db = createClient({ url: `file:${dbPath}` });

  const probe = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='User' LIMIT 1");
  if (probe.rows.length > 0) {
    console.log("Database already initialized. Skipping.");
    await db.close();
    return;
  }

  const sql = readFileSync(resolve(__dirname, "init.sql"), "utf8");
  const statements = sql.split(";").map((s) => s.trim()).filter((s) => s.length > 0);

  for (const stmt of statements) {
    await db.execute(stmt);
  }

  console.log("Database schema created successfully.");
  await db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
