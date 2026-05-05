import Link from "next/link";
import { AdminForms } from "@/components/ClientForms";
import { prisma } from "@/server/db/prisma";

export default async function CdksPage() {
  const [cdks, accounts] = await Promise.all([
    prisma.cdk.findMany({ include: { gptAccount: true, redeemedByUser: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.gptAccount.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <Link href="/admin" className="text-sm text-slate-400">返回后台</Link>
      <h1 className="mt-6 text-3xl font-bold text-white">CDK 管理</h1>
      <div className="mt-8"><AdminForms initialAccounts={accounts.map((account) => ({ id: account.id, label: account.label, loginEmail: account.loginEmail }))} /></div>
      <div className="mt-8 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950 text-slate-300"><tr><th className="p-4">完整 CDK</th><th>微信名</th><th>账号</th><th>天数</th><th>剩余</th><th>状态</th><th>过期时间</th></tr></thead>
          <tbody>
            {cdks.map((cdk) => (
              <tr key={cdk.id} className="border-t border-slate-800"><td className="p-4 font-mono">{cdk.code || `旧数据-${cdk.displayCodeLast4}`}</td><td>{cdk.redeemedByUser?.wechatName || cdk.redeemedByFingerprint || "未绑定"}</td><td>{cdk.gptAccount.label}</td><td>{cdk.durationDays}</td><td>{cdk.remainingUses}/{cdk.maxUses}</td><td>{cdk.status}</td><td>{cdk.validUntil?.toLocaleString() || "未激活"}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
