import "server-only";

import { randomBytes } from "crypto";
import { db, generateId } from "@/server/db/db";
import type { CdkRow, GptAccountRow, UserRow } from "@/server/db/types";
import { sha256 } from "@/server/security/encryption";
import { fetchVerificationCode } from "@/server/services/emailCodeService";
import { createMonthlyMembership } from "@/server/services/monthlyMembershipService";

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function hashCode(code: string) {
  return sha256(normalizeCode(code));
}

function generateCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(12);
  const chars = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]);
  return `GM-${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}`;
}

function publicCdk(cdk: { code?: string | null; status: string; durationDays: number; maxUses: number; remainingUses: number; validUntil: string | null; displayCodeLast4: string }) {
  return {
    code: cdk.code,
    status: cdk.status,
    durationDays: cdk.durationDays,
    maxUses: cdk.maxUses,
    remainingUses: cdk.remainingUses,
    validUntil: cdk.validUntil,
    displayCodeLast4: cdk.displayCodeLast4,
  };
}

function rowToCdk(row: Record<string, unknown>): CdkRow {
  return {
    id: row.id as string,
    codeHash: row.codeHash as string,
    code: row.code as string | null,
    displayCodeLast4: row.displayCodeLast4 as string,
    durationDays: row.durationDays as number,
    maxUses: row.maxUses as number,
    remainingUses: row.remainingUses as number,
    status: row.status as CdkRow["status"],
    gptAccountId: row.gptAccountId as string,
    createdByAdminId: row.createdByAdminId as string,
    activatedAt: row.activatedAt as string | null,
    validUntil: row.validUntil as string | null,
    redeemedByUserId: row.redeemedByUserId as string | null,
    redeemedByFingerprint: row.redeemedByFingerprint as string | null,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
  };
}

function rowToAccount(row: Record<string, unknown>, prefix = "g_"): GptAccountRow {
  return {
    id: row[`${prefix}id`] as string,
    label: row[`${prefix}label`] as string,
    loginEmail: row[`${prefix}loginEmail`] as string,
    encryptedPassword: row[`${prefix}encryptedPassword`] as string,
    status: row[`${prefix}status`] as GptAccountRow["status"],
    capacity: row[`${prefix}capacity`] as number,
    notes: row[`${prefix}notes`] as string | null,
    createdAt: row[`${prefix}createdAt`] as string,
    updatedAt: row[`${prefix}updatedAt`] as string,
  };
}

function rowToUser(row: Record<string, unknown>, prefix: string): UserRow | null {
  if (!row[`${prefix}id`]) return null;
  return {
    id: row[`${prefix}id`] as string,
    email: row[`${prefix}email`] as string,
    wechatName: row[`${prefix}wechatName`] as string | null,
    passwordHash: row[`${prefix}passwordHash`] as string,
    role: row[`${prefix}role`] as UserRow["role"],
    name: row[`${prefix}name`] as string | null,
    status: row[`${prefix}status`] as UserRow["status"],
    createdAt: row[`${prefix}createdAt`] as string,
    updatedAt: row[`${prefix}updatedAt`] as string,
    lastLoginAt: row[`${prefix}lastLoginAt`] as string | null,
  };
}

export async function listCdks() {
  const result = await db.execute(
    "SELECT Cdk.*, g.id as g_id, g.label as g_label, g.loginEmail as g_loginEmail, g.encryptedPassword as g_encryptedPassword, g.status as g_status, g.capacity as g_capacity, g.notes as g_notes, g.createdAt as g_createdAt, g.updatedAt as g_updatedAt, ca.id as ca_id, ca.email as ca_email, ca.wechatName as ca_wechatName, ca.passwordHash as ca_passwordHash, ca.role as ca_role, ca.name as ca_name, ca.status as ca_status, ca.createdAt as ca_createdAt, ca.updatedAt as ca_updatedAt, ca.lastLoginAt as ca_lastLoginAt, ru.id as ru_id, ru.email as ru_email, ru.wechatName as ru_wechatName, ru.passwordHash as ru_passwordHash, ru.role as ru_role, ru.name as ru_name, ru.status as ru_status, ru.createdAt as ru_createdAt, ru.updatedAt as ru_updatedAt, ru.lastLoginAt as ru_lastLoginAt FROM Cdk JOIN GptAccount g ON Cdk.gptAccountId = g.id JOIN User ca ON Cdk.createdByAdminId = ca.id LEFT JOIN User ru ON Cdk.redeemedByUserId = ru.id ORDER BY Cdk.createdAt DESC"
  );
  return result.rows.map((row) => ({
    ...rowToCdk(row),
    gptAccount: rowToAccount(row),
    createdByAdmin: rowToUser(row, "ca_"),
    redeemedByUser: rowToUser(row, "ru_"),
  }));
}

export async function createCdkWithSeat(input: {
  wechatName: string;
  durationDays: number;
  gptAccountId: string;
  adminId: string;
  startsAt: Date;
  endsAt: Date;
  requestLimitPerDay: number;
}) {
  const code = generateCode();
  const id = generateId();

  await db.execute({
    sql: "INSERT INTO Cdk (id, codeHash, code, displayCodeLast4, durationDays, maxUses, remainingUses, gptAccountId, createdByAdminId, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNUSED', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
    args: [id, hashCode(code), code, code.slice(-4), input.durationDays, input.durationDays, input.durationDays, input.gptAccountId, input.adminId],
  });

  const membership = await createMonthlyMembership({
    wechatName: input.wechatName,
    cdkCode: code,
    gptAccountId: input.gptAccountId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    requestLimitPerDay: input.requestLimitPerDay,
  });

  const cdkResult = await db.execute({ sql: "SELECT * FROM Cdk WHERE id = ?", args: [id] });
  return { cdk: { ...rowToCdk(cdkResult.rows[0]), code }, membership };
}

export async function redeemCdk(code: string, fingerprint?: string) {
  const codeHash = hashCode(code);
  const now = new Date();
  const tx = await db.transaction("write");

  try {
    const result = await tx.execute({ sql: "SELECT * FROM Cdk WHERE codeHash = ?", args: [codeHash] });
    const existingRow = result.rows[0];
    if (!existingRow) throw new Error("CDK 不存在或已失效");
    const existing = rowToCdk(existingRow);

    if (existing.status === "REVOKED") throw new Error("CDK 已作废");
    if (existing.status === "EXHAUSTED") throw new Error("CDK 次数已用完");
    if (existing.validUntil && new Date(existing.validUntil) <= now) {
      await tx.execute({ sql: "UPDATE Cdk SET status = 'EXPIRED', updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", args: [existing.id] });
      await tx.commit();
      throw new Error("CDK 已过期");
    }

    let cdk = existing;
    if (existing.status === "UNUSED") {
      const validUntil = new Date(now.getTime() + existing.durationDays * 24 * 60 * 60 * 1000).toISOString();
      await tx.execute({
        sql: "UPDATE Cdk SET status = 'ACTIVE', activatedAt = ?, validUntil = ?, redeemedByFingerprint = ?, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
        args: [now.toISOString(), validUntil, fingerprint ?? null, existing.id],
      });
      const updated = await tx.execute({ sql: "SELECT * FROM Cdk WHERE id = ?", args: [existing.id] });
      cdk = rowToCdk(updated.rows[0]);
    }

    await tx.commit();
    return publicCdk(cdk);
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

export async function requestCodeByCdk(input: { code: string; ipHash?: string; userAgent?: string }) {
  const codeHash = hashCode(input.code);
  const now = new Date();
  const tx = await db.transaction("write");
  let pending: { cdk: CdkRow & { gptAccount: GptAccountRow }; request: { id: string; createdAt: string } };

  try {
    const result = await tx.execute({
      sql: "SELECT Cdk.*, g.id as g_id, g.label as g_label, g.loginEmail as g_loginEmail, g.encryptedPassword as g_encryptedPassword, g.status as g_status, g.capacity as g_capacity, g.notes as g_notes, g.createdAt as g_createdAt, g.updatedAt as g_updatedAt FROM Cdk JOIN GptAccount g ON Cdk.gptAccountId = g.id WHERE Cdk.codeHash = ?",
      args: [codeHash],
    });
    const row = result.rows[0];
    if (!row) throw new Error("CDK 不存在或已失效");
    const cdk = { ...rowToCdk(row), gptAccount: rowToAccount(row) };
    if (cdk.status === "REVOKED") throw new Error("CDK 已作废");
    if (cdk.status === "EXHAUSTED") throw new Error("CDK 次数已用完");
    if (cdk.validUntil && new Date(cdk.validUntil) <= now) {
      await tx.execute({ sql: "UPDATE Cdk SET status = 'EXPIRED', updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", args: [cdk.id] });
      throw new Error("CDK 已过期");
    }
    if (cdk.remainingUses <= 0) throw new Error("CDK 次数已用完");

    const requestId = generateId();
    await tx.execute({
      sql: "INSERT INTO EmailCodeRequest (id, sourceType, cdkId, gptAccountId, targetEmail, status, createdAt) VALUES (?, 'CDK', ?, ?, ?, 'PENDING', strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
      args: [requestId, cdk.id, cdk.gptAccountId, cdk.gptAccount.loginEmail],
    });
    const requestResult = await tx.execute({ sql: "SELECT id, createdAt FROM EmailCodeRequest WHERE id = ?", args: [requestId] });
    const requestRow = requestResult.rows[0];
    pending = { cdk, request: { id: requestRow.id as string, createdAt: requestRow.createdAt as string } };
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }

  try {
    const result = await fetchVerificationCode({
      requestId: pending.request.id,
      sourceType: "CDK",
      gptAccountId: pending.cdk.gptAccountId,
      targetEmail: pending.cdk.gptAccount.loginEmail,
      startedAt: now,
    });

    const updateTx = await db.transaction("write");
    let updated: CdkRow;
    try {
      const currentResult = await updateTx.execute({
        sql: "SELECT Cdk.*, g.id as g_id, g.label as g_label, g.loginEmail as g_loginEmail, g.encryptedPassword as g_encryptedPassword, g.status as g_status, g.capacity as g_capacity, g.notes as g_notes, g.createdAt as g_createdAt, g.updatedAt as g_updatedAt FROM Cdk JOIN GptAccount g ON Cdk.gptAccountId = g.id WHERE Cdk.id = ?",
        args: [pending.cdk.id],
      });
      const currentRow = currentResult.rows[0];
      if (!currentRow) throw new Error("CDK 不存在或已失效");
      const current = rowToCdk(currentRow);
      if (current.status === "REVOKED") throw new Error("CDK 已作废");
      if (current.validUntil && new Date(current.validUntil) <= new Date()) {
        await updateTx.execute({ sql: "UPDATE Cdk SET status = 'EXPIRED', updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", args: [current.id] });
        throw new Error("CDK 已过期");
      }
      if (current.remainingUses <= 0) throw new Error("CDK 次数已用完");

      const activatedAt = current.activatedAt ?? now.toISOString();
      const validUntil = current.validUntil ?? new Date(now.getTime() + current.durationDays * 24 * 60 * 60 * 1000).toISOString();
      const nextRemainingUses = current.remainingUses - 1;

      await updateTx.execute({
        sql: "UPDATE Cdk SET status = ?, activatedAt = ?, validUntil = ?, remainingUses = ?, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
        args: [nextRemainingUses === 0 ? "EXHAUSTED" : "ACTIVE", activatedAt, validUntil, nextRemainingUses, current.id],
      });

      await updateTx.execute({
        sql: "INSERT INTO CdkRedemption (id, cdkId, ipHash, userAgent, status, emailCodeRequestId, createdAt) VALUES (?, ?, ?, ?, 'SUCCESS', ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
        args: [generateId(), current.id, input.ipHash ?? null, input.userAgent ?? null, pending.request.id],
      });

      const updatedResult = await updateTx.execute({ sql: "SELECT * FROM Cdk WHERE id = ?", args: [current.id] });
      updated = rowToCdk(updatedResult.rows[0]);
      await updateTx.commit();
    } catch (error) {
      await updateTx.rollback();
      throw error;
    }

    return { ...result, cdk: publicCdk(updated) };
  } catch (error) {
    await db.execute({
      sql: "INSERT INTO CdkRedemption (id, cdkId, ipHash, userAgent, status, failureReason, emailCodeRequestId, createdAt) VALUES (?, ?, ?, ?, 'FAILED', ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
      args: [generateId(), pending.cdk.id, input.ipHash ?? null, input.userAgent ?? null, error instanceof Error ? error.message : "取码失败", pending.request.id],
    });
    throw error;
  }
}

export async function revokeCdk(id: string) {
  await db.execute({ sql: "UPDATE Cdk SET status = 'REVOKED', updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", args: [id] });
  const result = await db.execute({ sql: "SELECT * FROM Cdk WHERE id = ?", args: [id] });
  return rowToCdk(result.rows[0]);
}

export async function deleteCdk(id: string) {
  const tx = await db.transaction("write");
  try {
    const existing = await tx.execute({ sql: "SELECT * FROM Cdk WHERE id = ?", args: [id] });
    if (!existing.rows[0]) throw new Error("CDK 不存在");
    await tx.execute({ sql: "DELETE FROM CdkRedemption WHERE cdkId = ?", args: [id] });
    await tx.execute({ sql: "UPDATE EmailCodeRequest SET cdkId = NULL WHERE cdkId = ?", args: [id] });
    await tx.execute({ sql: "DELETE FROM Cdk WHERE id = ?", args: [id] });
    await tx.commit();
    return rowToCdk(existing.rows[0]);
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}
