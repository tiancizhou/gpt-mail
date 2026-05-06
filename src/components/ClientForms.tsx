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
};

function formatProviderTime(value: string) {
  const normalized = value.trim().replace(" ", "T");
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  const date = new Date(hasTimezone ? normalized : `${normalized}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function RedeemForm() {
  const [code, setCode] = useState("");
  const [state, setState] = useState<ApiState<{ data: { remainingUses: number; validUntil: string | null; status: string } }>>({ loading: false });
  const [emails, setEmails] = useState<VerificationEmail[]>([]);
  const [requesting, setRequesting] = useState(false);

  async function redeem(event: FormEvent) {
    event.preventDefault();
    setEmails([]);
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
    setEmails([]);
    try {
      const data = await postJson<{ data: { emails?: VerificationEmail[]; cdk: { remainingUses: number; validUntil: string | null; status: string } } }>("/api/cdk/request-code", { code });
      setEmails(data.data.emails || []);
      setState({ data: { data: data.data.cdk }, loading: false });
    } catch (error) {
      setState((current) => ({ ...current, error: error instanceof Error ? error.message : "取码失败", loading: false }));
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="hud-panel p-0">
      <form onSubmit={redeem} className="p-5 pb-0 space-y-3">
        <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="输入 CDK，例如 GM-XXXX-XXXX-XXXX" className="field" required />
        <button disabled={state.loading} className="btn">
          {state.loading ? "校验中..." : "兑换或查看 CDK"}
        </button>
      </form>
      {state.error && <p className="px-5 pt-4 text-sm text-rose-400">{state.error}</p>}
      {state.data && (
        <div className="mx-5 mt-5 border-t border-cyan-500/15 pt-4 space-y-3">
          <p className="text-cyan-300 text-sm">状态：<span className="text-cyan-100">{state.data.data.status}</span></p>
          <p className="text-cyan-300 text-sm">剩余取码次数：<span className="text-cyan-100">{state.data.data.remainingUses}</span></p>
          <p className="text-cyan-300 text-sm">有效期：<span className="text-cyan-100">{state.data.data.validUntil ? new Date(state.data.data.validUntil).toLocaleString() : "未激活"}</span></p>
          <button
            onClick={requestCode}
            disabled={requesting || state.data.data.remainingUses <= 0}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-400 px-4 py-3 font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all duration-200 ease-out hover:shadow-emerald-500/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
          >
            {requesting ? "正在查询邮件..." : "获取验证码"}
          </button>
        </div>
      )}
      {emails.length > 0 && (
        <div className="mt-5 divide-y divide-cyan-500/15">
          {emails.map((email) => (
            <div key={email.emailId} className="px-5 py-4">
              <div className="space-y-1 text-sm text-slate-400">
                <p className="font-semibold text-cyan-100">{email.subject || "无主题"}</p>
                <p>发件人：{email.sendName ? `${email.sendName} <${email.sendEmail}>` : email.sendEmail}</p>
                <p>收件人：{email.toName ? `${email.toName} <${email.toEmail}>` : email.toEmail}</p>
                <p>时间：{formatProviderTime(email.createTime)}</p>
              </div>
              {email.text && <pre className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-300">{email.text}</pre>}
              {email.content && <iframe title={`邮件 HTML ${email.emailId}`} sandbox="" srcDoc={email.content} className="mt-3 h-80 w-full bg-white" />}
            </div>
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
