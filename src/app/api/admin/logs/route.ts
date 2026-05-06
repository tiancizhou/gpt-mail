import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/server/db/db";

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;
  const result = await db.execute(
    "SELECT a.*, u.email as actor_email, u.name as actor_name FROM AuditLog a LEFT JOIN User u ON a.actorUserId = u.id ORDER BY a.createdAt DESC LIMIT 100"
  );
  const logs = result.rows.map((row) => ({
    id: row.id,
    actorUserId: row.actorUserId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    metadataJson: row.metadataJson,
    ipHash: row.ipHash,
    userAgent: row.userAgent,
    createdAt: row.createdAt,
    actor: row.actor_email ? { email: row.actor_email, name: row.actor_name } : null,
  }));
  return NextResponse.json({ data: logs });
}
