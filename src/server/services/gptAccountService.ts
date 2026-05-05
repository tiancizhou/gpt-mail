import "server-only";

import { GptAccountStatus } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { encryptText } from "@/server/security/encryption";

export async function listGptAccounts() {
  return prisma.gptAccount.findMany({
    where: { status: { not: GptAccountStatus.ARCHIVED } },
    include: {
      _count: {
        select: { memberships: true, cdks: true },
      },
      cdks: {
        include: { redeemedByUser: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createGptAccount(input: {
  label: string;
  loginEmail: string;
  password: string;
  capacity: number;
  notes?: string;
}) {
  return prisma.gptAccount.create({
    data: {
      label: input.label,
      loginEmail: input.loginEmail,
      encryptedPassword: encryptText(input.password),
      capacity: input.capacity,
      notes: input.notes,
    },
  });
}

export async function updateGptAccount(id: string, input: {
  label?: string;
  loginEmail?: string;
  password?: string;
  capacity?: number;
  notes?: string;
  status?: GptAccountStatus;
}) {
  return prisma.gptAccount.update({
    where: { id },
    data: {
      label: input.label,
      loginEmail: input.loginEmail,
      encryptedPassword: input.password ? encryptText(input.password) : undefined,
      capacity: input.capacity,
      notes: input.notes,
      status: input.status,
    },
  });
}

export async function archiveGptAccount(id: string) {
  return prisma.gptAccount.update({
    where: { id },
    data: { status: GptAccountStatus.ARCHIVED },
  });
}
