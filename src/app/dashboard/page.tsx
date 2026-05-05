import { EmailCodeSourceType, EmailCodeRequestStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { getUserMemberships } from "@/server/services/monthlyMembershipService";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const memberships = await getUserMemberships(user.id);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const usage = await Promise.all(memberships.map(async (membership) => ({
    membershipId: membership.id,
    used: await prisma.emailCodeRequest.count({
      where: {
        userId: user.id,
        gptAccountId: membership.gptAccountId,
        sourceType: EmailCodeSourceType.MONTHLY,
        status: EmailCodeRequestStatus.SUCCESS,
        createdAt: { gte: todayStart },
      },
    }),
  })));

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-bold text-white">我的长期拼车</h1>
      <div className="mt-8 grid gap-4">
        {memberships.map((membership) => {
          const used = usage.find((item) => item.membershipId === membership.id)?.used || 0;
          return (
            <form key={membership.id} action="/api/monthly/request-code" className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="text-xl font-semibold">{membership.gptAccount.label}</h2>
              <p className="mt-2 text-slate-300">登录邮箱：{membership.gptAccount.loginEmail}</p>
              <p className="text-slate-300">到期时间：{membership.endsAt.toLocaleString()}</p>
              <p className="text-slate-300">今日已用：{used} / {membership.requestLimitPerDay}</p>
              <p className="mt-4 text-sm text-slate-400">长期用户取码请使用接口 `/api/monthly/request-code`，后续可在此页继续增强一键取码交互。</p>
            </form>
          );
        })}
        {memberships.length === 0 && <p className="rounded-3xl border border-slate-800 bg-slate-900 p-6 text-slate-300">当前没有有效长期车位。</p>}
      </div>
      </div>
    </main>
  );
}
