import "server-only";

import { db, generateId } from "@/server/db/db";

type AuditLogInput = {
  actorUserId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: unknown;
  ipHash?: string;
  userAgent?: string;
};

export async function writeAuditLog(input: AuditLogInput) {
  await db.execute({
    sql: "INSERT INTO AuditLog (id, actorUserId, action, entityType, entityId, metadataJson, ipHash, userAgent, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
    args: [
      generateId(),
      input.actorUserId ?? null,
      input.action,
      input.entityType ?? null,
      input.entityId ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
      input.ipHash ?? null,
      input.userAgent ?? null,
    ],
  });
}
