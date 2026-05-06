import Link from "next/link";
import { AdminForms } from "@/components/ClientForms";
import { listGptAccountsForAdmin } from "@/server/db/queries";

export default async function GptAccountsPage() {
  const accounts = await listGptAccountsForAdmin();

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <Link href="/admin" className="text-sm text-slate-400">返回后台</Link>
      <h1 className="mt-6 text-3xl font-bold text-white">GPT 账号管理</h1>
      <div className="mt-8"><AdminForms initialAccounts={accounts.map((account) => ({ id: account.id, label: account.label, loginEmail: account.loginEmail }))} /></div>
      <div className="mt-8 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950 text-slate-300"><tr><th className="p-4">名称</th><th>邮箱</th><th>容量</th><th>状态</th><th>CDK</th></tr></thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id} className="border-t border-slate-800"><td className="p-4">{account.label}</td><td>{account.loginEmail}</td><td>{account._count.memberships}/{account.capacity}</td><td>{account.status}</td><td>{account._count.cdks}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
