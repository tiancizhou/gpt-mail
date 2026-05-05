import "server-only";

import { prisma } from "@/server/db/prisma";

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
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : undefined,
      ipHash: input.ipHash,
      userAgent: input.userAgent,
    },
  });
}
