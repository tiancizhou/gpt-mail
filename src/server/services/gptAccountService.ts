import "server-only";

import { db, generateId } from "@/server/db/db";
import type { InValue } from "@libsql/client";
import type { GptAccountRow } from "@/server/db/types";
import { encryptText } from "@/server/security/encryption";

type AccountWithCounts = GptAccountRow & {
  _count: { memberships: number; cdks: number };
  cdks: (import("@/server/db/types").CdkRow & { redeemedByUser: import("@/server/db/types").UserRow | null })[];
};

export async function listGptAccounts() {
  const accountsResult = await db.execute("SELECT * FROM GptAccount WHERE status != 'ARCHIVED' ORDER BY createdAt DESC");

  const ids = accountsResult.rows.map((r) => r.id as string);
  if (ids.length === 0) return [];

  const membershipCounts = await db.execute({
    sql: "SELECT gptAccountId, COUNT(*) as cnt FROM MonthlyMembership WHERE gptAccountId IN (" + ids.map(() => "?").join(",") + ") GROUP BY gptAccountId",
    args: ids,
  });
  const cdkCounts = await db.execute({
    sql: "SELECT gptAccountId, COUNT(*) as cnt FROM Cdk WHERE gptAccountId IN (" + ids.map(() => "?").join(",") + ") GROUP BY gptAccountId",
    args: ids,
  });

  const membershipMap = new Map(membershipCounts.rows.map((r) => [r.gptAccountId as string, r.cnt as number]));
  const cdkMap = new Map(cdkCounts.rows.map((r) => [r.gptAccountId as string, r.cnt as number]));

  const cdksResult = await db.execute({
    sql: "SELECT Cdk.*, User.id as u_id, User.email as u_email, User.wechatName as u_wechatName, User.name as u_name FROM Cdk LEFT JOIN User ON Cdk.redeemedByUserId = User.id WHERE Cdk.gptAccountId IN (" + ids.map(() => "?").join(",") + ") ORDER BY Cdk.createdAt DESC",
    args: ids,
  });

  const cdksByAccount = new Map<string, AccountWithCounts["cdks"]>();
  for (const row of cdksResult.rows) {
    const accId = row.gptAccountId as string;
    if (!cdksByAccount.has(accId)) cdksByAccount.set(accId, []);

    const cdk: import("@/server/db/types").CdkRow & { redeemedByUser: import("@/server/db/types").UserRow | null } = {
      id: row.id as string,
      codeHash: row.codeHash as string,
      code: row.code as string | null,
      displayCodeLast4: row.displayCodeLast4 as string,
      durationDays: row.durationDays as number,
      maxUses: row.maxUses as number,
      remainingUses: row.remainingUses as number,
      status: row.status as import("@/server/db/types").CdkStatus,
      gptAccountId: accId,
      createdByAdminId: row.createdByAdminId as string,
      activatedAt: row.activatedAt as string | null,
      validUntil: row.validUntil as string | null,
      redeemedByUserId: row.redeemedByUserId as string | null,
      redeemedByFingerprint: row.redeemedByFingerprint as string | null,
      createdAt: row.createdAt as string,
      updatedAt: row.updatedAt as string,
      redeemedByUser: row.u_id ? {
        id: row.u_id as string,
        email: row.u_email as string,
        wechatName: row.u_wechatName as string | null,
        name: row.u_name as string | null,
      } as import("@/server/db/types").UserRow : null,
    };
    cdksByAccount.get(accId)!.push(cdk);
  }

  return accountsResult.rows.map((row): AccountWithCounts => ({
    id: row.id as string,
    label: row.label as string,
    loginEmail: row.loginEmail as string,
    encryptedPassword: row.encryptedPassword as string,
    status: row.status as import("@/server/db/types").GptAccountStatus,
    capacity: row.capacity as number,
    notes: row.notes as string | null,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
    _count: { memberships: membershipMap.get(row.id as string) ?? 0, cdks: cdkMap.get(row.id as string) ?? 0 },
    cdks: cdksByAccount.get(row.id as string) ?? [],
  }));
}

export async function createGptAccount(input: {
  label: string;
  loginEmail: string;
  password: string;
  capacity: number;
  notes?: string;
}) {
  const id = generateId();
  await db.execute({
    sql: "INSERT INTO GptAccount (id, label, loginEmail, encryptedPassword, capacity, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
    args: [id, input.label, input.loginEmail, encryptText(input.password), input.capacity, input.notes ?? null],
  });
  const result = await db.execute({ sql: "SELECT * FROM GptAccount WHERE id = ?", args: [id] });
  return result.rows[0] as unknown as GptAccountRow;
}

export async function updateGptAccount(id: string, input: {
  label?: string;
  loginEmail?: string;
  password?: string;
  capacity?: number;
  notes?: string;
  status?: import("@/server/db/types").GptAccountStatus;
}) {
  const sets: string[] = [];
  const args: InValue[] = [];

  if (input.label !== undefined) { sets.push("label = ?"); args.push(input.label); }
  if (input.loginEmail !== undefined) { sets.push("loginEmail = ?"); args.push(input.loginEmail); }
  if (input.password !== undefined) { sets.push("encryptedPassword = ?"); args.push(encryptText(input.password)); }
  if (input.capacity !== undefined) { sets.push("capacity = ?"); args.push(input.capacity); }
  if (input.notes !== undefined) { sets.push("notes = ?"); args.push(input.notes); }
  if (input.status !== undefined) { sets.push("status = ?"); args.push(input.status); }

  sets.push("updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now')");
  args.push(id);

  await db.execute({ sql: `UPDATE GptAccount SET ${sets.join(", ")} WHERE id = ?`, args });
  const result = await db.execute({ sql: "SELECT * FROM GptAccount WHERE id = ?", args: [id] });
  return result.rows[0] as unknown as GptAccountRow;
}

export async function archiveGptAccount(id: string) {
  await db.execute({ sql: "UPDATE GptAccount SET status = 'ARCHIVED', updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", args: [id] });
  const result = await db.execute({ sql: "SELECT * FROM GptAccount WHERE id = ?", args: [id] });
  return result.rows[0] as unknown as GptAccountRow;
}
