import { AccountLogsLookupForm, RedeemForm } from "@/components/ClientForms";

export default function Home() {
  return (
    <main className="hud-page mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16 relative">
      <h1 className="text-3xl font-bold text-cyan-300" style={{ textShadow: "0 0 20px rgba(34,211,238,0.4)" }}>验证码小助手</h1>
      <p className="mt-3 mb-8 text-sm text-slate-400">输入 CDK 兑换并获取验证码，也可以通过共享邮箱查看拼车用户取码日志。</p>
      <div className="space-y-6">
        <RedeemForm />
        <AccountLogsLookupForm />
      </div>
    </main>
  );
}
