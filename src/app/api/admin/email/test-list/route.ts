import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/session";
import { listDomainEmails } from "@/server/email/domainEmailClient";
import { testEmailListSchema } from "@/server/validators/schemas";

export async function POST(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;
  const body = testEmailListSchema.parse(await request.json());
  const messages = await listDomainEmails({ toEmail: body.email, size: 5 });
  return NextResponse.json({
    data: messages.map((message) => ({
      emailId: message.emailId,
      sendEmail: message.sendEmail,
      sendName: message.sendName,
      subject: message.subject,
      toEmail: message.toEmail,
      createTime: message.createTime,
    })),
  });
}
