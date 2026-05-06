import "server-only";

import { db, generateId } from "@/server/db/db";
import type { MonthlyMembershipRow, UserRow, GptAccountRow, CdkStatus } from "@/server/db/types";
import { hashPassword } from "@/server/auth/password";
import { sha256 } from "@/server/security/encryption";

function normalizeCdkCode(code: string) {
  return code.trim().toUpperCase();
}

function hashCdkCode(code: string) {
  return sha256(normalizeCdkCode(code));
}

function userEmailFromWechatName(wechatName: string) {
  return `${sha256(wechatName).slice(0, 16)}@wechat.local`;
}

type MembershipWithRelations = MonthlyMembershipRow & { user: UserRow; gptAccount: GptAccountRow };

export async function listMonthlyMemberships() {
  const result = await db.execute(
    "SELECT m.*, u.id as u_id, u.email as u_email, u.wechatName as u_wechatName, u.passwordHash as u_passwordHash, u.role as u_role, u.name as u_name, u.status as u_status, u.createdAt as u_createdAt, u.updatedAt as u_updatedAt, u.lastLoginAt as u_lastLoginAt, g.id as g_id, g.label as g_label, g.loginEmail as g_loginEmail, g.encryptedPassword as g_encryptedPassword, g.status as g_status, g.capacity as g_capacity, g.notes as g_notes, g.createdAt as g_createdAt, g.updatedAt as g_updatedAt FROM MonthlyMembership m JOIN User u ON m.userId = u.id JOIN GptAccount g ON m.gptAccountId = g.id ORDER BY m.createdAt DESC LIMIT 100"
  );

  return result.rows.map((row): MembershipWithRelations => ({
    id: row.id as string,
    userId: row.userId as string,
    gptAccountId: row.gptAccountId as string,
    startsAt: row.startsAt as string,
    endsAt: row.endsAt as string,
    status: row.status as import("@/server/db/types").MembershipStatus,
    requestLimitPerDay: row.requestLimitPerDay as number,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
    user: {
      id: row.u_id as string,
      email: row.u_email as string,
      wechatName: row.u_wechatName as string | null,
      passwordHash: row.u_passwordHash as string,
      role: row.u_role as import("@/server/db/types").UserRole,
      name: row.u_name as string | null,
      status: row.u_status as import("@/server/db/types").UserStatus,
      createdAt: row.u_createdAt as string,
      updatedAt: row.u_updatedAt as string,
      lastLoginAt: row.u_lastLoginAt as string | null,
    },
    gptAccount: {
      id: row.g_id as string,
      label: row.g_label as string,
      loginEmail: row.g_loginEmail as string,
      encryptedPassword: row.g_encryptedPassword as string,
      status: row.g_status as import("@/server/db/types").GptAccountStatus,
      capacity: row.g_capacity as number,
      notes: row.g_notes as string | null,
      createdAt: row.g_createdAt as string,
      updatedAt: row.g_updatedAt as string,
    },
  }));
}

export async function createMonthlyMembership(input: {
  wechatName: string;
  cdkCode?: string;
  gptAccountId: string;
  startsAt: Date;
  endsAt: Date;
  requestLimitPerDay: number;
}) {
  if (input.endsAt <= input.startsAt) {
    throw new Error("结束时间必须晚于开始时间");
  }

  const tx = await db.transaction("write");

  try {
    const accountResult = await tx.execute({ sql: "SELECT * FROM GptAccount WHERE id = ?", args: [input.gptAccountId] });
    const account = accountResult.rows[0];
    if (!account) throw new Error("GPT 账号不存在");

    const nowIso = new Date().toISOString();
    const countResult = await tx.execute({
      sql: "SELECT COUNT(*) as cnt FROM MonthlyMembership WHERE gptAccountId = ? AND status = 'ACTIVE' AND endsAt > ?",
      args: [input.gptAccountId, nowIso],
    });
    if ((countResult.rows[0].cnt as number) >= (account.capacity as number)) {
      throw new Error("这个 GPT 账号车位已满");
    }

    const email = userEmailFromWechatName(input.wechatName);
    const existingUser = await tx.execute({ sql: "SELECT * FROM User WHERE email = ?", args: [email] });

    let userId: string;
    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].id as string;
      await tx.execute({
        sql: "UPDATE User SET wechatName = ?, name = ?, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
        args: [input.wechatName, input.wechatName, userId],
      });
    } else {
      userId = generateId();
      await tx.execute({
        sql: "INSERT INTO User (id, email, wechatName, name, passwordHash, role, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 'USER', 'ACTIVE', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
        args: [userId, email, input.wechatName, input.wechatName, await hashPassword(crypto.randomUUID())],
      });
    }

    if (input.cdkCode) {
      const codeHash = hashCdkCode(input.cdkCode);
      const cdkResult = await tx.execute({ sql: "SELECT id, status FROM Cdk WHERE codeHash = ?", args: [codeHash] });
      const cdk = cdkResult.rows[0];
      if (!cdk) throw new Error("CDK 不存在");
      const cdkStatus = cdk.status as CdkStatus;
      if (cdkStatus === "REVOKED" || cdkStatus === "EXHAUSTED" || cdkStatus === "EXPIRED") {
        throw new Error("CDK 当前不可绑定");
      }
      await tx.execute({
        sql: "UPDATE Cdk SET redeemedByUserId = ?, redeemedByFingerprint = ?, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
        args: [userId, input.wechatName, cdk.id],
      });
    }

    const membershipId = generateId();
    await tx.execute({
      sql: "INSERT INTO MonthlyMembership (id, userId, gptAccountId, startsAt, endsAt, requestLimitPerDay, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
      args: [membershipId, userId, input.gptAccountId, input.startsAt.toISOString(), input.endsAt.toISOString(), input.requestLimitPerDay],
    });

    await tx.commit();

    const fullResult = await db.execute({
      sql: "SELECT m.*, u.id as u_id, u.email as u_email, u.wechatName as u_wechatName, u.passwordHash as u_passwordHash, u.role as u_role, u.name as u_name, u.status as u_status, u.createdAt as u_createdAt, u.updatedAt as u_updatedAt, u.lastLoginAt as u_lastLoginAt, g.id as g_id, g.label as g_label, g.loginEmail as g_loginEmail, g.encryptedPassword as g_encryptedPassword, g.status as g_status, g.capacity as g_capacity, g.notes as g_notes, g.createdAt as g_createdAt, g.updatedAt as g_updatedAt FROM MonthlyMembership m JOIN User u ON m.userId = u.id JOIN GptAccount g ON m.gptAccountId = g.id WHERE m.id = ?",
      args: [membershipId],
    });
    const row = fullResult.rows[0];
    return {
      id: row.id as string,
      userId: row.userId as string,
      gptAccountId: row.gptAccountId as string,
      startsAt: row.startsAt as string,
      endsAt: row.endsAt as string,
      status: row.status as import("@/server/db/types").MembershipStatus,
      requestLimitPerDay: row.requestLimitPerDay as number,
      createdAt: row.createdAt as string,
      updatedAt: row.updatedAt as string,
      user: {
        id: row.u_id as string,
        email: row.u_email as string,
        wechatName: row.u_wechatName as string | null,
        passwordHash: row.u_passwordHash as string,
        role: row.u_role as import("@/server/db/types").UserRole,
        name: row.u_name as string | null,
        status: row.u_status as import("@/server/db/types").UserStatus,
        createdAt: row.u_createdAt as string,
        updatedAt: row.u_updatedAt as string,
        lastLoginAt: row.u_lastLoginAt as string | null,
      },
      gptAccount: {
        id: row.g_id as string,
        label: row.g_label as string,
        loginEmail: row.g_loginEmail as string,
        encryptedPassword: row.g_encryptedPassword as string,
        status: row.g_status as import("@/server/db/types").GptAccountStatus,
        capacity: row.g_capacity as number,
        notes: row.g_notes as string | null,
        createdAt: row.g_createdAt as string,
        updatedAt: row.g_updatedAt as string,
      },
    } satisfies MembershipWithRelations;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

export async function getActiveUserMembership(userId: string, gptAccountId: string) {
  const nowIso = new Date().toISOString();
  const result = await db.execute({
    sql: "SELECT m.*, g.id as g_id, g.label as g_label, g.loginEmail as g_loginEmail, g.encryptedPassword as g_encryptedPassword, g.status as g_status, g.capacity as g_capacity, g.notes as g_notes, g.createdAt as g_createdAt, g.updatedAt as g_updatedAt FROM MonthlyMembership m JOIN GptAccount g ON m.gptAccountId = g.id WHERE m.userId = ? AND m.gptAccountId = ? AND m.status = 'ACTIVE' AND m.startsAt <= ? AND m.endsAt > ? LIMIT 1",
    args: [userId, gptAccountId, nowIso, nowIso],
  });
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id as string,
    userId: row.userId as string,
    gptAccountId: row.gptAccountId as string,
    startsAt: row.startsAt as string,
    endsAt: row.endsAt as string,
    status: row.status as import("@/server/db/types").MembershipStatus,
    requestLimitPerDay: row.requestLimitPerDay as number,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
    gptAccount: {
      id: row.g_id as string,
      label: row.g_label as string,
      loginEmail: row.g_loginEmail as string,
      encryptedPassword: row.g_encryptedPassword as string,
      status: row.g_status as import("@/server/db/types").GptAccountStatus,
      capacity: row.g_capacity as number,
      notes: row.g_notes as string | null,
      createdAt: row.g_createdAt as string,
      updatedAt: row.g_updatedAt as string,
    },
  };
}

export async function getUserMemberships(userId: string) {
  const nowIso = new Date().toISOString();
  const result = await db.execute({
    sql: "SELECT m.*, g.id as g_id, g.label as g_label, g.loginEmail as g_loginEmail, g.encryptedPassword as g_encryptedPassword, g.status as g_status, g.capacity as g_capacity, g.notes as g_notes, g.createdAt as g_createdAt, g.updatedAt as g_updatedAt FROM MonthlyMembership m JOIN GptAccount g ON m.gptAccountId = g.id WHERE m.userId = ? AND m.status = 'ACTIVE' AND m.startsAt <= ? AND m.endsAt > ? ORDER BY m.endsAt ASC",
    args: [userId, nowIso, nowIso],
  });

  return result.rows.map((row) => ({
    id: row.id as string,
    userId: row.userId as string,
    gptAccountId: row.gptAccountId as string,
    startsAt: row.startsAt as string,
    endsAt: row.endsAt as string,
    status: row.status as import("@/server/db/types").MembershipStatus,
    requestLimitPerDay: row.requestLimitPerDay as number,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
    gptAccount: {
      id: row.g_id as string,
      label: row.g_label as string,
      loginEmail: row.g_loginEmail as string,
      encryptedPassword: row.g_encryptedPassword as string,
      status: row.g_status as import("@/server/db/types").GptAccountStatus,
      capacity: row.g_capacity as number,
      notes: row.g_notes as string | null,
      createdAt: row.g_createdAt as string,
      updatedAt: row.g_updatedAt as string,
    },
  }));
}
