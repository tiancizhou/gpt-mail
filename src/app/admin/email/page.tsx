import Link from "next/link";

export default function EmailAdminPage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12">
      <Link href="/admin" className="text-sm text-slate-400">返回后台</Link>
      <h1 className="mt-6 text-3xl font-bold text-white">邮箱接口</h1>
      <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-6">
        <p className="text-slate-300">邮箱 token、管理员邮箱和密码只从服务端环境变量读取。这里第一版提供 API：</p>
        <ul className="mt-4 list-disc space-y-2 pl-6 text-slate-300">
          <li><code>POST /api/admin/email/test-token</code> 测试 token 获取。</li>
          <li><code>POST /api/admin/email/test-list</code> 查询指定收件邮箱最新邮件。</li>
          <li><code>POST /api/admin/email/add-user</code> 添加域名邮箱用户。</li>
        </ul>
      </div>
    </main>
  );
}
