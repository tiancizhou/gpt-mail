import "server-only";

import { EmailCodeRequestStatus, EmailCodeSourceType } from "@prisma/client";
import { env } from "@/server/config/env";
import { prisma } from "@/server/db/prisma";
import { DomainEmailMessage, listDomainEmails } from "@/server/email/domainEmailClient";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function extractVerificationCode(message: DomainEmailMessage) {
  const text = `${message.subject}\n${message.text}\n${message.content}`;
  const patterns = [
    /verification code[:：\s]+(\d{6})/i,
    /code[:：\s]+(\d{6})/i,
    /验证码[:：\s]*(\d{6})/i,
    /\b(\d{6})\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

export function maskCode(code: string) {
  return `${code.slice(0, 2)}****`;
}

function parseProviderTime(value: string) {
  const normalized = value.replace(" ", "T");
  const date = new Date(normalized.endsWith("Z") ? normalized : `${normalized}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export type VerificationEmail = Pick<DomainEmailMessage, "emailId" | "sendEmail" | "sendName" | "subject" | "toEmail" | "toName" | "createTime" | "content" | "text"> & {
  verificationCode: string | null;
};

export type VerificationCodeResult = {
  code: string;
  codes: string[];
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
          verificationCode: extractVerificationCode(message),
        });
        if (emails.length === 3) break;
      }

      if (emails.length > 0) {
        const codes = emails.flatMap((email) => (email.verificationCode ? [email.verificationCode] : []));
        await prisma.emailCodeRequest.update({
          where: { id: input.requestId },
          data: {
            status: EmailCodeRequestStatus.SUCCESS,
            verificationCodeMasked: codes[0] ? maskCode(codes[0]) : null,
            providerMessageId: String(emails[0].emailId),
            completedAt: new Date(),
          },
        });
        return { code: codes[0] || "", codes, emails };
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : "邮件接口查询失败";
    }

    await sleep(env.EMAIL_CODE_POLL_INTERVAL_SECONDS * 1000);
  }

  await prisma.emailCodeRequest.update({
    where: { id: input.requestId },
    data: {
      status: EmailCodeRequestStatus.TIMEOUT,
      errorMessage: lastError || "未找到验证码邮件",
      completedAt: new Date(),
    },
  });

  throw new Error(lastError || "未找到验证码邮件");
}
