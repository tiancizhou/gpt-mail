import { AccountLogsLookupForm, RedeemForm } from "@/components/ClientForms";

export default function Home() {
  return (
    <main className="hud-page px-4 py-6 sm:px-6 lg:px-8">
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl flex-col justify-center">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.32em] text-cyan-400/80">GPT Mail Assistant</p>
            <h1 className="text-4xl font-bold tracking-tight text-cyan-100 sm:text-5xl" style={{ textShadow: "0 0 24px rgba(34,211,238,0.35)" }}>验证码小助手</h1>
          </div>
          <p className="max-w-xl text-sm leading-6 text-slate-400 lg:text-right">输入 CDK 兑换并获取验证码；也可以通过共享邮箱查看拼车用户取码日志，方便成员之间相互监督。</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
          <RedeemForm />
          <AccountLogsLookupForm />
        </div>
      </div>
    </main>
  );
}
