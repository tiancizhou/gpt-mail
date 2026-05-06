import Link from "next/link";
import { AdminForms } from "@/components/ClientForms";
import { listActiveGptAccountOptions, listMembershipsForAdmin } from "@/server/db/queries";

export default async function MonthlyMembershipsPage() {
  const [memberships, accounts] = await Promise.all([
    listMembershipsForAdmin(),
    listActiveGptAccountOptions(),
  ]);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <Link href="/admin" className="text-sm text-slate-400">返回后台</Link>
      <h1 className="mt-6 text-3xl font-bold text-white">长期车位管理</h1>
      <div className="mt-8"><AdminForms initialAccounts={accounts.map((account) => ({ id: account.id as string, label: account.label as string, loginEmail: account.loginEmail as string }))} /></div>
      <div className="mt-8 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950 text-slate-300"><tr><th className="p-4">微信名</th><th>账号</th><th>开始</th><th>结束</th><th>每日限制</th><th>状态</th></tr></thead>
          <tbody>
            {memberships.map((membership) => (
              <tr key={membership.id} className="border-t border-slate-800"><td className="p-4">{membership.user.wechatName || membership.user.name || membership.user.email}</td><td>{membership.gptAccount.label}</td><td>{new Date(membership.startsAt).toLocaleString()}</td><td>{new Date(membership.endsAt).toLocaleString()}</td><td>{membership.requestLimitPerDay}</td><td>{membership.status}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
