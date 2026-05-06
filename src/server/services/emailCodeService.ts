import "server-only";

import { env } from "@/server/config/env";
import { db } from "@/server/db/db";
import type { EmailCodeSourceType } from "@/server/db/types";
import { DomainEmailMessage, listDomainEmails } from "@/server/email/domainEmailClient";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseProviderTime(value: string) {
  const normalized = value.replace(" ", "T");
  const date = new Date(normalized.endsWith("Z") ? normalized : `${normalized}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export type VerificationEmail = Pick<DomainEmailMessage, "emailId" | "sendEmail" | "sendName" | "subject" | "toEmail" | "toName" | "createTime" | "content" | "text">;

export type VerificationCodeResult = {
  emails: VerificationEmail[];
};

export async function fetchVerificationCode(input: {
  requestId: string;
  sourceType: EmailCodeSourceType;
  gptAccountId: string;
  targetEmail: string;
  startedAt?: Date;
}) {
  const startedAt = input.startedAt ?? new Date();
  const timeoutAt = Date.now() + env.EMAIL_CODE_POLL_TIMEOUT_SECONDS * 1000;
  let lastError: string | null = null;

  while (Date.now() <= timeoutAt) {
    try {
      const messages = await listDomainEmails({
        toEmail: input.targetEmail,
        timeSort: "desc",
        type: 0,
        isDel: 0,
        size: 10,
      });

      const emails: VerificationEmail[] = [];

      for (const message of messages) {
        const providerDate = parseProviderTime(message.createTime);
        if (providerDate && providerDate.getTime() + 120_000 < startedAt.getTime()) {
          continue;
        }

        emails.push({
          emailId: message.emailId,
          sendEmail: message.sendEmail,
          sendName: message.sendName,
          subject: message.subject,
          toEmail: message.toEmail,
          toName: message.toName,
          createTime: message.createTime,
          content: message.content,
          text: message.text,
        });
        if (emails.length === 3) break;
      }

      if (emails.length > 0) {
        await db.execute({
          sql: "UPDATE EmailCodeRequest SET status = 'SUCCESS', providerMessageId = ?, completedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
          args: [String(emails[0].emailId), input.requestId],
        });
        return { emails };
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : "邮件接口查询失败";
    }

    await sleep(env.EMAIL_CODE_POLL_INTERVAL_SECONDS * 1000);
  }

  await db.execute({
    sql: "UPDATE EmailCodeRequest SET status = 'TIMEOUT', errorMessage = ?, completedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
    args: [lastError || "未找到验证码邮件", input.requestId],
  });

  throw new Error(lastError || "未找到验证码邮件");
}
