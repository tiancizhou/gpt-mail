import Link from "next/link";
import { listCdkEmailRequests } from "@/server/db/queries";

export default async function LogsPage() {
  const requests = await listCdkEmailRequests();

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <Link href="/admin" className="text-sm text-slate-400">返回后台</Link>
      <h1 className="mt-6 text-3xl font-bold text-white">CDK 验证码使用记录</h1>
      <div className="mt-8 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950 text-slate-300"><tr><th className="p-4">时间</th><th>微信名</th><th>CDK</th><th>GPT 账号</th><th>状态</th><th>验证码</th></tr></thead>
          <tbody>
            {requests.map((item) => (
              <tr key={item.id as string} className="border-t border-slate-800">
                <td className="p-4">{new Date(item.createdAt as string).toLocaleString()}</td>
                <td>{item.cdk?.redeemedByUser?.wechatName || item.cdk?.redeemedByFingerprint || "未绑定"}</td>
                <td className="font-mono">{item.cdk?.code || (item.cdk ? `旧数据-${item.cdk.displayCodeLast4}` : "")}</td>
                <td>{item.gptAccount.label}</td>
                <td>{item.status}</td>
                <td>{item.verificationCodeMasked || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {requests.length === 0 && <p className="p-6 text-slate-400">暂无 CDK 接收验证码记录。</p>}
      </div>
    </main>
  );
}
