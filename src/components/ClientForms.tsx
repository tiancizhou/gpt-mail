"use client";

import { FormEvent, useState } from "react";

type ApiState<T> = {
  data?: T;
  error?: string;
  loading: boolean;
};

async function postJson<T>(url: string, body?: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data as T;
}

export function LoginForm() {
  const [state, setState] = useState<ApiState<{ user: { role: string } }>>({ loading: false });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ loading: true });
    const form = new FormData(event.currentTarget);
    try {
      const data = await postJson<{ user: { role: string } }>("/api/auth/login", {
        email: form.get("email"),
        password: form.get("password"),
      });
      setState({ data, loading: false });
      window.location.href = data.user.role === "ADMIN" ? "/admin" : "/dashboard";
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : "登录失败", loading: false });
    }
  }

  return (
    <form onSubmit={submit} className="hud-panel space-y-4 p-6">
      <input name="email" type="email" placeholder="邮箱" className="field" required />
      <input name="password" type="password" placeholder="密码" className="field" required />
      <button disabled={state.loading} className="btn">
        {state.loading ? "登录中..." : "登录"}
      </button>
      {state.error && <p className="text-sm text-rose-400">{state.error}</p>}
    </form>
  );
}

type VerificationEmail = {
  emailId: number;
  sendEmail: string;
  sendName: string;
  subject: string;
  toEmail: string;
  toName: string;
  createTime: string;
  content: string;
  text: string;
  verificationCode: string | null;
};

export function RedeemForm() {
  const [code, setCode] = useState("");
  const [state, setState] = useState<ApiState<{ data: { remainingUses: number; validUntil: string | null; status: string } }>>({ loading: false });
  const [verificationCodes, setVerificationCodes] = useState<string[]>([]);
  const [verificationEmails, setVerificationEmails] = useState<VerificationEmail[]>([]);
  const [requesting, setRequesting] = useState(false);

  async function redeem(event: FormEvent) {
    event.preventDefault();
    setVerificationCodes([]);
    setVerificationEmails([]);
    setState({ loading: true });
    try {
      const data = await postJson<{ data: { remainingUses: number; validUntil: string | null; status: string } }>("/api/cdk/redeem", { code });
      setState({ data, loading: false });
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : "兑换失败", loading: false });
    }
  }

  async function requestCode() {
    setRequesting(true);
    setVerificationCodes([]);
    setVerificationEmails([]);
    try {
      const data = await postJson<{ data: { code: string; codes?: string[]; emails?: VerificationEmail[]; cdk: { remainingUses: number; validUntil: string | null; status: string } } }>("/api/cdk/request-code", { code });
      setVerificationCodes(data.data.codes?.length ? data.data.codes : data.data.code ? [data.data.code] : []);
      setVerificationEmails(data.data.emails || []);
      setState({ data: { data: data.data.cdk }, loading: false });
    } catch (error) {
      setState((current) => ({ ...current, error: error instanceof Error ? error.message : "取码失败", loading: false }));
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="rounded-3xl border border-pink-200 bg-white/80 p-6 shadow-lg shadow-pink-100/50 backdrop-blur-sm">
      <form onSubmit={redeem} className="space-y-4">
        <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="输入 CDK，例如 GM-XXXX-XXXX-XXXX" className="field" required />
        <button disabled={state.loading} className="btn">
          {state.loading ? "校验中..." : "兑换或查看 CDK"}
        </button>
      </form>
      {state.error && <p className="mt-4 text-sm text-rose-400">{state.error}</p>}
      {state.data && (
        <div className="mt-6 space-y-3 rounded-2xl bg-violet-50/80 border border-violet-200 p-4">
          <p className="text-violet-600">状态：{state.data.data.status}</p>
          <p className="text-violet-600">剩余取码次数：{state.data.data.remainingUses}</p>
          <p className="text-violet-600">有效期：{state.data.data.validUntil ? new Date(state.data.data.validUntil).toLocaleString() : "未激活"}</p>
          <button
            onClick={requestCode}
            disabled={requesting || state.data.data.remainingUses <= 0}
            className="w-full rounded-xl bg-gradient-to-r from-teal-300 to-emerald-300 px-4 py-3 font-semibold text-white shadow-md shadow-teal-200/50 transition-all duration-250 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:shadow-teal-200/60 active:translate-y-0 disabled:opacity-60"
          >
            {requesting ? "正在查询邮件..." : "获取验证码"}
          </button>
        </div>
      )}
      {verificationCodes.length > 0 && (
        <div className="mt-6 space-y-3 rounded-2xl bg-gradient-to-br from-pink-50 to-amber-50 border border-pink-200 p-5 text-center shadow-md shadow-pink-100/40">
          <p className="text-sm font-medium text-pink-400">最近获取到的验证码</p>
          {verificationCodes.map((verificationCode, index) => (
            <div key={`${verificationCode}-${index}`} className={index === 0 ? "text-4xl font-bold tracking-widest text-violet-600" : "text-2xl font-semibold tracking-widest text-pink-400"}>
              {verificationCode}
            </div>
          ))}
        </div>
      )}
      {verificationEmails.length > 0 && (
        <div className="mt-6 space-y-4">
          {verificationEmails.map((email) => (
            <article key={email.emailId} className="overflow-hidden rounded-2xl border border-pink-200 bg-white/90 shadow-sm">
              <div className="space-y-1 border-b border-pink-100 p-4 text-sm text-violet-500">
                <p className="font-semibold text-violet-700">{email.subject || "无主题"}</p>
                <p>发件人：{email.sendName ? `${email.sendName} <${email.sendEmail}>` : email.sendEmail}</p>
                <p>收件人：{email.toName ? `${email.toName} <${email.toEmail}>` : email.toEmail}</p>
                <p>时间：{email.createTime}</p>
                {email.verificationCode && <p className="text-teal-500 font-semibold">验证码：{email.verificationCode}</p>}
              </div>
              {email.text && <pre className="whitespace-pre-wrap break-words p-4 text-sm text-violet-600/80">{email.text}</pre>}
              {email.content && <iframe title={`邮件 HTML ${email.emailId}`} sandbox="" srcDoc={email.content} className="h-80 w-full bg-white rounded-b-2xl" />}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminForms({ initialAccounts = [] }: { initialAccounts?: Array<{ id: string; label: string; loginEmail: string }> }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [message, setMessage] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");

  async function loadAccounts() {
    const response = await fetch("/api/admin/gpt-accounts");
    const data = await response.json();
    setAccounts(data.data || []);
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    const form = new FormData(target);
    await postJson("/api/admin/gpt-accounts", {
      label: form.get("label"),
      loginEmail: form.get("loginEmail"),
      password: form.get("password"),
      capacity: Number(form.get("capacity") || 3),
      notes: form.get("notes") || undefined,
    });
    setMessage("GPT 账号已创建");
    target.reset();
    await loadAccounts();
  }

  async function createSeatCdk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    const form = new FormData(target);
    const durationDays = Number(form.get("durationDays"));
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const data = await postJson<{ data: { cdk: { code: string } } }>("/api/admin/cdks", {
      wechatName: form.get("wechatName"),
      durationDays,
      gptAccountId: form.get("gptAccountId"),
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      requestLimitPerDay: Number(form.get("requestLimitPerDay") || 3),
    });
    setGeneratedCode(data.data.cdk.code);
    setMessage("车位和 CDK 已创建并绑定");
    target.reset();
  }


  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <form onSubmit={createAccount} className="space-y-3 rounded-3xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-xl font-semibold">新增 GPT 账号</h2>
        <input name="label" placeholder="账号名称" className="field" required />
        <input name="loginEmail" type="email" placeholder="GPT 登录邮箱" className="field" required />
        <input name="password" type="password" placeholder="GPT 密码" className="field" required />
        <input name="capacity" type="number" defaultValue="3" className="field" />
        <input name="notes" placeholder="备注" className="field" />
        <button className="btn">创建账号</button>
      </form>
      <form onSubmit={createSeatCdk} className="space-y-3 rounded-3xl border border-slate-800 bg-slate-900 p-5 lg:col-span-2">
        <h2 className="text-xl font-semibold">分配车位并生成 CDK</h2>
        <input name="wechatName" placeholder="用户微信名" className="field" required />
        <select name="gptAccountId" className="field" required>
          <option value="">选择 GPT 账号</option>
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.label} / {account.loginEmail}</option>)}
        </select>
        <input name="durationDays" type="number" min="1" max="31" placeholder="天数，也是可取码次数" className="field" required />
        <p className="text-sm text-slate-400">开始时间自动使用当前时间，结束时间按天数自动计算。</p>
        <input name="requestLimitPerDay" type="number" defaultValue="3" placeholder="每日取码限制" className="field" />
        <button className="btn">创建车位和 CDK</button>
      </form>
      {message && <p className="lg:col-span-3 text-emerald-300">{message}</p>}
      {generatedCode && (
        <div className="lg:col-span-3 rounded-3xl border border-amber-500/30 bg-amber-950/30 p-5">
          <h2 className="text-xl font-semibold">新生成并绑定的 CDK</h2>
          <pre className="mt-4 whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 text-lg font-semibold">{generatedCode}</pre>
        </div>
      )}
    </div>
  );
}
