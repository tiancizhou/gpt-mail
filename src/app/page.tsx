import { AccountLogsLookupForm, RedeemForm } from "@/components/ClientForms";

export default function Home() {
  return (
    <main className="hud-page px-5 py-10 sm:px-8 lg:px-10">
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl flex-col justify-center">
        <div className="mb-8 max-w-3xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.32em] text-cyan-400/80">GPT Mail Assistant</p>
          <h1 className="text-4xl font-bold tracking-tight text-cyan-100 sm:text-5xl" style={{ textShadow: "0 0 24px rgba(34,211,238,0.35)" }}>验证码小助手</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">输入 CDK 兑换并获取验证码；也可以通过共享邮箱查看拼车用户取码日志，方便成员之间相互监督。</p>
        </div>
        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <RedeemForm />
          <AccountLogsLookupForm />
        </div>
      </div>
    </main>
  );
}
