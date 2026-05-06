"use client";

import clsx from "clsx";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Copy,
  KeyRound,
  Loader2,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";

type Account = {
  id: string;
  label: string;
  loginEmail: string;
  capacity: number;
  status: string;
  _count: { memberships: number; cdks: number };
  cdks: Cdk[];
};

type Cdk = {
  id: string;
  code: string | null;
  displayCodeLast4: string;
  durationDays: number;
  maxUses: number;
  remainingUses: number;
  status: string;
  validUntil: string | Date | null;
  redeemedByFingerprint: string | null;
  redeemedByUser: { wechatName: string | null; name: string | null; email: string } | null;
};

type CdkLog = {
  id: string;
  status: string;
  verificationCodeMasked: string | null;
  errorMessage: string | null;
  createdAt: string | Date;
  completedAt: string | Date | null;
  gptAccount: { label: string; loginEmail: string };
};

type Toast = { type: "success" | "error"; message: string };
type StatusFilter = "ALL" | "ACTIVE" | "DISABLED";
type ConfirmState = { type: "account"; account: Account } | { type: "cdk"; cdk: Cdk };
type EditCapacityState = { account: Account };

type DashboardStats = {
  totalAccounts: number;
  activeAccounts: number;
  usedSeats: number;
  totalCapacity: number;
  totalCdks: number;
  activeCdks: number;
  expiringSoon: number;
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

async function deleteJson<T>(url: string) {
  const response = await fetch(url, { method: "DELETE" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "删除失败");
  return data as T;
}

async function patchJson<T>(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "保存失败");
  return data as T;
}

export function AdminDashboard({ initialAccounts }: { initialAccounts: Account[] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [selectedAccountId, setSelectedAccountId] = useState(initialAccounts[0]?.id || "");
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [cdkAccountId, setCdkAccountId] = useState<string | null>(null);
  const [logCdk, setLogCdk] = useState<Cdk | null>(null);
  const [cdkLogs, setCdkLogs] = useState<CdkLog[]>([]);
  const [cdkLogsLoading, setCdkLogsLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [isReloading, setIsReloading] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [editCapacityState, setEditCapacityState] = useState<EditCapacityState | null>(null);
  const [copiedCdkId, setCopiedCdkId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) || accounts[0] || null,
    [accounts, selectedAccountId],
  );
  const cdkAccount = accounts.find((account) => account.id === cdkAccountId) || null;

  const filteredAccounts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return accounts.filter((account) => {
      const matchesQuery = !query || account.label.toLowerCase().includes(query) || account.loginEmail.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "ALL" || account.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [accounts, searchQuery, statusFilter]);

  const stats = useMemo<DashboardStats>(() => {
    const cdks = accounts.flatMap((account) => account.cdks);
    return {
      totalAccounts: accounts.length,
      activeAccounts: accounts.filter((account) => account.status === "ACTIVE").length,
      usedSeats: accounts.reduce((sum, account) => sum + account._count.memberships, 0),
      totalCapacity: accounts.reduce((sum, account) => sum + account.capacity, 0),
      totalCdks: cdks.length,
      activeCdks: cdks.filter((cdk) => cdk.status === "ACTIVE" || cdk.status === "UNUSED").length,
      expiringSoon: cdks.filter((cdk) => isExpiringSoon(cdk, now)).length,
    };
  }, [accounts, now]);

  function showToast(type: Toast["type"], message: string) {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3000);
  }

  async function reloadAccounts(nextSelectedId?: string, options: { silent?: boolean } = {}) {
    setIsReloading(true);
    try {
      const response = await fetch("/api/admin/gpt-accounts");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "刷新失败");
      const nextAccounts = data.data || [];
      setAccounts(nextAccounts);
      if (nextSelectedId) setSelectedAccountId(nextSelectedId);
      else if (!nextAccounts.some((account: Account) => account.id === selectedAccountId)) setSelectedAccountId(nextAccounts[0]?.id || "");
      if (!options.silent) showToast("success", "账号列表已刷新");
    } catch (error) {
      showToast("error", getErrorMessage(error, "刷新失败"));
    } finally {
      setIsReloading(false);
    }
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    const form = new FormData(target);
    setLoadingAction("create-account");
    try {
      const data = await postJson<{ data: Account }>("/api/admin/gpt-accounts", {
        label: form.get("label"),
        loginEmail: form.get("loginEmail"),
        password: form.get("password"),
        capacity: Number(form.get("capacity") || 3),
        notes: form.get("notes") || undefined,
      });
      showToast("success", "GPT 账号已创建");
      setAddAccountOpen(false);
      target.reset();
      await reloadAccounts(data.data.id, { silent: true });
    } catch (error) {
      showToast("error", getErrorMessage(error, "创建账号失败"));
    } finally {
      setLoadingAction(null);
    }
  }

  async function createSeatCdk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    const form = new FormData(target);
    setLoadingAction("create-cdk");
    try {
      const data = await postJson<{ data: { cdk: { code: string } } }>("/api/admin/cdks", {
        wechatName: form.get("wechatName"),
        durationDays: Number(form.get("durationDays")),
        gptAccountId: cdkAccountId,
        requestLimitPerDay: Number(form.get("requestLimitPerDay") || 3),
      });
      setGeneratedCode(data.data.cdk.code);
      showToast("success", "车位和 CDK 已创建并绑定");
      target.reset();
      await reloadAccounts(cdkAccountId || undefined, { silent: true });
    } catch (error) {
      showToast("error", getErrorMessage(error, "生成 CDK 失败"));
    } finally {
      setLoadingAction(null);
    }
  }

  function requestDeleteAccount(account: Account) {
    setConfirmState({ type: "account", account });
  }

  function requestDeleteCdk(cdk: Cdk) {
    setConfirmState({ type: "cdk", cdk });
  }

  function requestEditCapacity(account: Account) {
    setEditCapacityState({ account });
  }

  async function updateCapacity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editCapacityState) return;
    const form = new FormData(event.currentTarget);
    const capacity = Number(form.get("capacity") || editCapacityState.account.capacity);
    setLoadingAction(`update-capacity-${editCapacityState.account.id}`);
    try {
      await patchJson<{ data: Account }>(`/api/admin/gpt-accounts/${editCapacityState.account.id}`, { capacity });
      showToast("success", "车位数量已更新");
      setEditCapacityState(null);
      await reloadAccounts(editCapacityState.account.id, { silent: true });
    } catch (error) {
      showToast("error", getErrorMessage(error, "保存车位数量失败"));
    } finally {
      setLoadingAction(null);
    }
  }

  async function confirmDelete() {
    if (!confirmState) return;
    const action = confirmState.type === "account" ? `delete-account-${confirmState.account.id}` : `delete-cdk-${confirmState.cdk.id}`;
    setLoadingAction(action);
    try {
      if (confirmState.type === "account") {
        await deleteJson(`/api/admin/gpt-accounts/${confirmState.account.id}`);
        showToast("success", "GPT 账号已删除");
        setConfirmState(null);
        await reloadAccounts(undefined, { silent: true });
      } else {
        await deleteJson(`/api/admin/cdks/${confirmState.cdk.id}`);
        showToast("success", "CDK 已删除");
        setConfirmState(null);
        await reloadAccounts(selectedAccount?.id, { silent: true });
      }
    } catch (error) {
      showToast("error", getErrorMessage(error, "删除失败"));
    } finally {
      setLoadingAction(null);
    }
  }

  async function showCdkLogs(cdk: Cdk) {
    setLogCdk(cdk);
    setCdkLogs([]);
    setCdkLogsLoading(true);
    try {
      const response = await fetch(`/api/admin/email-code-requests?cdkId=${encodeURIComponent(cdk.id)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "日志加载失败");
      setCdkLogs(data.data || []);
    } catch (error) {
      showToast("error", getErrorMessage(error, "日志加载失败"));
    } finally {
      setCdkLogsLoading(false);
    }
  }

  async function copyCode(code: string, cdkId = "generated") {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCdkId(cdkId);
      showToast("success", "CDK 已复制");
      window.setTimeout(() => setCopiedCdkId(null), 1500);
    } catch {
      showToast("error", "复制失败，请手动复制 CDK");
    }
  }

  function openCdkModal(account: Account) {
    setSelectedAccountId(account.id);
    setCdkAccountId(account.id);
    setGeneratedCode("");
  }

  return (
    <div className="space-y-6">
      <AdminHeader
        stats={stats}
        isReloading={isReloading}
        onAddAccount={() => setAddAccountOpen(true)}
        onReload={() => void reloadAccounts(undefined, { silent: false })}
      />

      {generatedCode && (
        <GeneratedCodeBanner code={generatedCode} copied={copiedCdkId === "generated"} onCopy={() => void copyCode(generatedCode)} onDismiss={() => setGeneratedCode("")} />
      )}

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[390px_minmax(0,1fr)]">
        <AccountList
          accounts={filteredAccounts}
          totalAccounts={accounts.length}
          selectedAccountId={selectedAccount?.id || ""}
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          onSearchChange={setSearchQuery}
          onStatusFilterChange={setStatusFilter}
          onSelectAccount={setSelectedAccountId}
          onCreateCdk={openCdkModal}
          onEditCapacity={requestEditCapacity}
          onDeleteAccount={requestDeleteAccount}
          onAddAccount={() => setAddAccountOpen(true)}
        />

        <AccountDetail
          account={selectedAccount}
          copiedCdkId={copiedCdkId}
          now={now}
          onCreateCdk={openCdkModal}
          onEditCapacity={requestEditCapacity}
          onDeleteCdk={requestDeleteCdk}
          onShowLogs={(cdk) => void showCdkLogs(cdk)}
          onCopyCdk={(cdk) => void copyCode(getCdkDisplayCode(cdk), cdk.id)}
          onAddAccount={() => setAddAccountOpen(true)}
        />
      </div>

      {addAccountOpen && (
        <Modal title="增加 GPT 账号" description="创建后会出现在左侧账号列表，可继续为该账号生成 CDK。" onClose={() => setAddAccountOpen(false)}>
          <form onSubmit={createAccount} className="space-y-4">
            <Field label="账号名称"><input name="label" placeholder="例如：GPT 共享账号 A" className="field" required /></Field>
            <Field label="GPT 登录邮箱"><input name="loginEmail" type="email" placeholder="name@example.com" className="field" required /></Field>
            <Field label="GPT 密码"><input name="password" type="password" placeholder="请输入 GPT 密码" className="field" required /></Field>
            <Field label="车位容量"><input name="capacity" type="number" defaultValue="3" min="1" className="field" /></Field>
            <Field label="备注"><input name="notes" placeholder="可选" className="field" /></Field>
            <button disabled={loadingAction === "create-account"} className="btn inline-flex items-center justify-center gap-2" aria-label="创建 GPT 账号">
              {loadingAction === "create-account" && <Loader2 className="h-4 w-4 animate-spin" />}
              {loadingAction === "create-account" ? "创建中..." : "创建账号"}
            </button>
          </form>
        </Modal>
      )}

      {cdkAccount && (
        <Modal title={`为 ${cdkAccount.label} 生成 CDK`} description={cdkAccount.loginEmail} onClose={() => setCdkAccountId(null)}>
          <form onSubmit={createSeatCdk} className="space-y-4">
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-100">
              <p className="font-semibold">当前账号：{cdkAccount.label}</p>
              <p className="mt-1 text-cyan-200/80">天数会自动换算为可取码次数，开始和结束时间由服务端计算。</p>
            </div>
            <Field label="用户微信名"><input name="wechatName" placeholder="请输入用户微信名" className="field" required /></Field>
            <Field label="天数 / 可取码次数"><input name="durationDays" type="number" min="1" max="31" placeholder="例如：3" className="field" required /></Field>
            <Field label="每日取码限制"><input name="requestLimitPerDay" type="number" defaultValue="3" min="1" className="field" /></Field>
            {generatedCode && (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                <p className="text-sm font-semibold text-emerald-100">新 CDK 已生成</p>
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-950/70 p-3">
                  <code className="min-w-0 flex-1 truncate font-mono text-sm text-emerald-100">{generatedCode}</code>
                  <button type="button" onClick={() => void copyCode(generatedCode)} className="rounded-lg border border-emerald-400/30 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-400/10">
                    复制
                  </button>
                </div>
              </div>
            )}
            <button disabled={loadingAction === "create-cdk"} className="btn inline-flex items-center justify-center gap-2" aria-label="创建车位和 CDK">
              {loadingAction === "create-cdk" && <Loader2 className="h-4 w-4 animate-spin" />}
              {loadingAction === "create-cdk" ? "生成中..." : "创建车位和 CDK"}
            </button>
          </form>
        </Modal>
      )}

      {logCdk && (
        <Modal title="CDK 验证码日志" description={getCdkDisplayCode(logCdk)} onClose={() => setLogCdk(null)} wide>
          <CdkLogsTable logs={cdkLogs} loading={cdkLogsLoading} />
        </Modal>
      )}

      {editCapacityState && (
        <Modal title="修改车位数量" description={`${editCapacityState.account.label} · 当前使用 ${editCapacityState.account._count.memberships}/${editCapacityState.account.capacity}`} onClose={() => setEditCapacityState(null)}>
          <form onSubmit={updateCapacity} className="space-y-4">
            <Field label="车位容量"><input name="capacity" type="number" defaultValue={editCapacityState.account.capacity} min="1" max="10" className="field" required /></Field>
            <button disabled={loadingAction === `update-capacity-${editCapacityState.account.id}`} className="btn inline-flex items-center justify-center gap-2" aria-label="保存车位数量">
              {loadingAction === `update-capacity-${editCapacityState.account.id}` && <Loader2 className="h-4 w-4 animate-spin" />}
              {loadingAction === `update-capacity-${editCapacityState.account.id}` ? "保存中..." : "保存车位数量"}
            </button>
          </form>
        </Modal>
      )}

      {confirmState && (
        <ConfirmDialog
          title={confirmState.type === "account" ? "删除 GPT 账号" : "删除 CDK"}
          description={confirmState.type === "account" ? `确定删除账号「${confirmState.account.label}」吗？这个账号会从列表隐藏。` : `确定删除 CDK「${getCdkDisplayCode(confirmState.cdk)}」吗？相关使用记录会同步处理。`}
          loading={loadingAction?.startsWith("delete-") || false}
          onCancel={() => setConfirmState(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}

      <ToastViewport toast={toast} />
    </div>
  );
}

function AdminHeader({ stats, isReloading, onAddAccount, onReload }: { stats: DashboardStats; isReloading: boolean; onAddAccount: () => void; onReload: () => void }) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/40 backdrop-blur md:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
            <ShieldCheck className="h-3.5 w-3.5" /> Admin Console
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-4xl">管理员后台</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 md:text-base">集中管理 GPT 账号、车位 CDK 和验证码使用记录，快速完成生成、复制、查看日志和删除操作。</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={onReload} disabled={isReloading} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/40 hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-60" aria-label="刷新账号列表">
            <RefreshCw className={clsx("h-4 w-4", isReloading && "animate-spin")} />
            刷新
          </button>
          <button type="button" onClick={onAddAccount} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-400 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-950/40 transition hover:scale-[1.02] hover:shadow-cyan-900/40" aria-label="增加账号">
            <Plus className="h-4 w-4" />
            增加账号
          </button>
        </div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5" />} label="GPT 账号" value={`${stats.totalAccounts}`} subValue={`${stats.activeAccounts} 个启用中`} tone="cyan" />
        <StatCard icon={<UserRound className="h-5 w-5" />} label="车位使用" value={`${stats.usedSeats}/${stats.totalCapacity}`} subValue="已分配 / 总容量" tone="emerald" />
        <StatCard icon={<KeyRound className="h-5 w-5" />} label="CDK 总数" value={`${stats.totalCdks}`} subValue={`${stats.activeCdks} 个可用`} tone="blue" />
        <StatCard icon={<AlertTriangle className="h-5 w-5" />} label="即将过期" value={`${stats.expiringSoon}`} subValue="未来 3 天内" tone="amber" />
      </div>
    </section>
  );
}

function StatCard({ icon, label, value, subValue, tone }: { icon: ReactNode; label: string; value: string; subValue: string; tone: "cyan" | "emerald" | "blue" | "amber" }) {
  const tones = {
    cyan: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200",
    emerald: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    blue: "border-blue-400/20 bg-blue-400/10 text-blue-200",
    amber: "border-amber-400/20 bg-amber-400/10 text-amber-200",
  };
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4 shadow-lg shadow-slate-950/20">
      <div className="flex items-center justify-between gap-3">
        <div className={clsx("rounded-2xl border p-2.5", tones[tone])}>{icon}</div>
        <span className="text-xs text-slate-500">实时统计</span>
      </div>
      <p className="mt-4 text-sm text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{subValue}</p>
    </div>
  );
}

function GeneratedCodeBanner({ code, copied, onCopy, onDismiss }: { code: string; copied: boolean; onCopy: () => void; onDismiss: () => void }) {
  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-4 shadow-lg shadow-emerald-950/20 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-100"><CheckCircle2 className="h-4 w-4" /> 新 CDK 已生成</p>
        <code className="mt-2 block truncate font-mono text-base text-emerald-50">{code}</code>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCopy} className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/30 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-300/10" aria-label="复制新生成的 CDK">
          <Copy className="h-4 w-4" /> {copied ? "已复制" : "复制"}
        </button>
        <button type="button" onClick={onDismiss} className="rounded-xl border border-white/10 px-3 py-2 text-slate-300 hover:bg-white/5" aria-label="关闭新 CDK 提示"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

function AccountList(props: {
  accounts: Account[];
  totalAccounts: number;
  selectedAccountId: string;
  searchQuery: string;
  statusFilter: StatusFilter;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: StatusFilter) => void;
  onSelectAccount: (id: string) => void;
  onCreateCdk: (account: Account) => void;
  onEditCapacity: (account: Account) => void;
  onDeleteAccount: (account: Account) => void;
  onAddAccount: () => void;
}) {
  return (
    <aside className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-4 shadow-2xl shadow-slate-950/30 backdrop-blur">
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-xl font-bold text-white">账号列表</h2>
          <p className="mt-1 text-xs text-slate-500">选择账号查看 CDK 明细</p>
        </div>
        <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-xs font-semibold text-slate-300">{props.accounts.length}/{props.totalAccounts}</span>
      </div>
      <div className="mt-4 space-y-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input value={props.searchQuery} onChange={(event) => props.onSearchChange(event.target.value)} placeholder="搜索账号名称 / 邮箱" className="field pl-10" aria-label="搜索账号名称或邮箱" />
        </label>
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-slate-950/50 p-1">
          {(["ALL", "ACTIVE", "DISABLED"] as StatusFilter[]).map((item) => (
            <button key={item} type="button" onClick={() => props.onStatusFilterChange(item)} className={clsx("rounded-xl px-3 py-2 text-xs font-semibold transition", props.statusFilter === item ? "bg-cyan-400/20 text-cyan-100" : "text-slate-400 hover:bg-white/5 hover:text-slate-200")} aria-label={`筛选 ${getFilterLabel(item)}`}>
              {getFilterLabel(item)}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {props.accounts.map((account) => (
          <AccountCard key={account.id} account={account} selected={account.id === props.selectedAccountId} onSelect={() => props.onSelectAccount(account.id)} onCreateCdk={() => props.onCreateCdk(account)} onEditCapacity={() => props.onEditCapacity(account)} onDelete={() => props.onDeleteAccount(account)} />
        ))}
        {props.totalAccounts === 0 && <EmptyState icon={<Users className="h-6 w-6" />} title="还没有 GPT 账号" description="创建第一个账号后即可分配车位并生成 CDK。" actionLabel="增加账号" onAction={props.onAddAccount} />}
        {props.totalAccounts > 0 && props.accounts.length === 0 && <EmptyState icon={<Search className="h-6 w-6" />} title="没有匹配的账号" description="尝试调整搜索关键词或状态筛选。" />}
      </div>
    </aside>
  );
}

function AccountCard({ account, selected, onSelect, onCreateCdk, onEditCapacity, onDelete }: { account: Account; selected: boolean; onSelect: () => void; onCreateCdk: () => void; onEditCapacity: () => void; onDelete: () => void }) {
  const usage = Math.min(100, Math.round((account._count.memberships / Math.max(account.capacity, 1)) * 100));
  return (
    <div className={clsx("group relative overflow-hidden rounded-3xl border p-4 transition duration-200", selected ? "border-cyan-300/60 bg-gradient-to-br from-cyan-500/15 via-blue-500/10 to-slate-900 shadow-lg shadow-cyan-950/30" : "border-white/10 bg-slate-950/40 hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-slate-900/80")}>
      {selected && <div className="absolute inset-y-4 left-0 w-1 rounded-r-full bg-cyan-300 shadow-[0_0_24px_rgba(103,232,249,0.8)]" />}
      <button type="button" onClick={onSelect} className="w-full text-left" aria-label={`选择账号 ${account.label}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-white">{account.label}</h3>
            <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-slate-400"><Mail className="h-3.5 w-3.5 shrink-0" />{account.loginEmail}</p>
          </div>
          <StatusBadge status={account.status} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-400">
          <MetricPill label="车位" value={`${account._count.memberships}/${account.capacity}`} />
          <MetricPill label="CDK" value={`${account._count.cdks}`} />
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${usage}%` }} />
        </div>
      </button>
      <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-2">
        <button type="button" onClick={onCreateCdk} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400/15 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/25" aria-label={`为 ${account.label} 生成 CDK`}>
          <KeyRound className="h-4 w-4" /> 生成 CDK
        </button>
        <button type="button" onClick={onEditCapacity} className="inline-flex items-center justify-center rounded-xl border border-cyan-400/20 px-3 py-2 text-cyan-200 transition hover:bg-cyan-400/10" aria-label={`修改账号 ${account.label} 的车位数量`}>
          <Pencil className="h-4 w-4" />
        </button>
        <button type="button" onClick={onDelete} className="inline-flex items-center justify-center rounded-xl border border-rose-400/20 px-3 py-2 text-rose-200 transition hover:bg-rose-400/10" aria-label={`删除账号 ${account.label}`}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function AccountDetail({ account, copiedCdkId, now, onCreateCdk, onEditCapacity, onDeleteCdk, onShowLogs, onCopyCdk, onAddAccount }: { account: Account | null; copiedCdkId: string | null; now: number; onCreateCdk: (account: Account) => void; onEditCapacity: (account: Account) => void; onDeleteCdk: (cdk: Cdk) => void; onShowLogs: (cdk: Cdk) => void; onCopyCdk: (cdk: Cdk) => void; onAddAccount: () => void }) {
  if (!account) {
    return <section className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-slate-950/30 backdrop-blur"><EmptyState icon={<ShieldCheck className="h-7 w-7" />} title="请选择或创建一个账号" description="选择左侧账号后，这里会显示账号摘要和该账号生成的 CDK 列表。" actionLabel="增加账号" onAction={onAddAccount} /></section>;
  }
  return (
    <section className="min-w-0 space-y-5">
      <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/30 backdrop-blur md:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="truncate text-2xl font-bold text-white">{account.label}</h2>
              <StatusBadge status={account.status} />
            </div>
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-400"><Mail className="h-4 w-4" />{account.loginEmail}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => onEditCapacity(account)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-3 text-sm font-bold text-cyan-100 transition hover:bg-cyan-400/20" aria-label={`修改 ${account.label} 的车位数量`}>
              <Pencil className="h-4 w-4" /> 改车位
            </button>
            <button type="button" onClick={() => onCreateCdk(account)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-400 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950/30 transition hover:scale-[1.02]" aria-label={`为 ${account.label} 生成 CDK`}>
              <KeyRound className="h-4 w-4" /> 生成 CDK
            </button>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <SummaryTile label="车位使用" value={`${account._count.memberships}/${account.capacity}`} icon={<Users className="h-4 w-4" />} />
          <SummaryTile label="已生成 CDK" value={`${account._count.cdks}`} icon={<KeyRound className="h-4 w-4" />} />
          <SummaryTile label="账号状态" value={getStatusLabel(account.status)} icon={<Activity className="h-4 w-4" />} />
        </div>
      </div>
      <CdkTable account={account} copiedCdkId={copiedCdkId} now={now} onCreateCdk={() => onCreateCdk(account)} onDeleteCdk={onDeleteCdk} onShowLogs={onShowLogs} onCopyCdk={onCopyCdk} />
    </section>
  );
}

function CdkTable({ account, copiedCdkId, now, onCreateCdk, onDeleteCdk, onShowLogs, onCopyCdk }: { account: Account; copiedCdkId: string | null; now: number; onCreateCdk: () => void; onDeleteCdk: (cdk: Cdk) => void; onShowLogs: (cdk: Cdk) => void; onCopyCdk: (cdk: Cdk) => void }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-4 shadow-2xl shadow-slate-950/30 backdrop-blur md:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-bold text-white">该账号生成的 CDK</h3>
          <p className="mt-1 text-sm text-slate-500">点击 CDK 或日志按钮可查看验证码获取记录。</p>
        </div>
        <button type="button" onClick={onCreateCdk} className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/20" aria-label={`为 ${account.label} 添加 CDK`}>
          <Plus className="h-4 w-4" /> 添加 CDK
        </button>
      </div>
      {account.cdks.length === 0 ? (
        <EmptyState icon={<KeyRound className="h-7 w-7" />} title="这个账号还没有 CDK" description="为该账号生成 CDK 后，用户就可以按天数获取验证码。" actionLabel="生成 CDK" onAction={onCreateCdk} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="min-w-[920px] w-full text-left text-sm">
            <thead className="bg-slate-950/80 text-xs uppercase tracking-wide text-slate-400">
              <tr><th className="p-4">完整 CDK</th><th>微信名</th><th>剩余次数</th><th>状态</th><th>到期时间</th><th className="pr-4 text-right">操作</th></tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {account.cdks.map((cdk) => (
                <tr key={cdk.id} className="transition hover:bg-white/[0.03]">
                  <td className="p-4">
                    <div className="flex max-w-[320px] items-center gap-2">
                      <button type="button" onClick={() => onShowLogs(cdk)} className="truncate font-mono text-sm text-cyan-200 underline-offset-4 hover:underline" aria-label={`查看 CDK ${getCdkDisplayCode(cdk)} 的日志`}>{getCdkDisplayCode(cdk)}</button>
                      <button type="button" onClick={() => onCopyCdk(cdk)} className="shrink-0 rounded-lg border border-white/10 p-2 text-slate-300 hover:border-cyan-300/30 hover:text-cyan-200" aria-label={`复制 CDK ${getCdkDisplayCode(cdk)}`}>
                        {copiedCdkId === cdk.id ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                  <td className="text-slate-300">{getBoundUserLabel(cdk)}</td>
                  <td className="w-36"><UsageProgress cdk={cdk} /></td>
                  <td><StatusBadge status={cdk.status} /></td>
                  <td><ExpiryBadge cdk={cdk} now={now} /></td>
                  <td className="pr-4">
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => onShowLogs(cdk)} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-400/20 px-3 py-2 text-xs font-semibold text-blue-200 hover:bg-blue-400/10" aria-label={`查看 CDK ${getCdkDisplayCode(cdk)} 日志`}><ClipboardList className="h-3.5 w-3.5" />日志</button>
                      <button type="button" onClick={() => onDeleteCdk(cdk)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/20 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-400/10" aria-label={`删除 CDK ${getCdkDisplayCode(cdk)}`}><Trash2 className="h-3.5 w-3.5" />删除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CdkLogsTable({ logs, loading }: { logs: CdkLog[]; loading: boolean }) {
  if (loading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-12 animate-pulse rounded-2xl bg-slate-800/60" />)}</div>;
  if (logs.length === 0) return <EmptyState icon={<ClipboardList className="h-7 w-7" />} title="这个 CDK 还没有获取验证码记录" description="用户使用该 CDK 获取验证码后，记录会显示在这里。" />;
  return (
    <div className="max-h-[60vh] overflow-auto rounded-2xl border border-white/10">
      <table className="min-w-[760px] w-full text-left text-sm">
        <thead className="bg-slate-950/80 text-xs uppercase tracking-wide text-slate-400"><tr><th className="p-3">时间</th><th>GPT 账号</th><th>状态</th><th>验证码</th><th>失败原因</th></tr></thead>
        <tbody className="divide-y divide-white/10">
          {logs.map((item) => (
            <tr key={item.id} className="hover:bg-white/[0.03]">
              <td className="p-3 text-slate-300">{formatDateTime(item.createdAt)}</td>
              <td className="text-slate-300">{item.gptAccount.label}</td>
              <td><StatusBadge status={item.status} /></td>
              <td className="font-mono text-emerald-200">{item.verificationCodeMasked || ""}</td>
              <td className="text-slate-400">{item.errorMessage || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConfirmDialog({ title, description, loading, onCancel, onConfirm }: { title: string; description: string; loading: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-3xl border border-rose-400/20 bg-slate-900 p-6 shadow-2xl shadow-slate-950">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-3 text-rose-200"><AlertTriangle className="h-5 w-5" /></div>
          <div>
            <h2 className="text-xl font-bold text-white">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={onCancel} disabled={loading} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60">取消</button>
          <button type="button" onClick={onConfirm} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-500/90 px-4 py-3 text-sm font-bold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "删除中..." : "确认删除"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToastViewport({ toast }: { toast: Toast | null }) {
  if (!toast) return null;
  const Icon = toast.type === "success" ? CheckCircle2 : XCircle;
  return (
    <div className="fixed right-4 top-4 z-[70] max-w-sm">
      <div className={clsx("flex items-start gap-3 rounded-2xl border p-4 shadow-2xl backdrop-blur", toast.type === "success" ? "border-emerald-400/30 bg-emerald-950/80 text-emerald-100" : "border-rose-400/30 bg-rose-950/80 text-rose-100")}>
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="text-sm font-medium">{toast.message}</p>
      </div>
    </div>
  );
}

function Modal({ title, description, children, onClose, wide = false }: { title: string; description?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className={clsx("max-h-[90vh] w-full overflow-auto rounded-[2rem] border border-white/10 bg-slate-900 p-6 shadow-2xl shadow-slate-950", wide ? "max-w-5xl" : "max-w-lg")}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">{title}</h2>
            {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-white/10 p-2 text-slate-300 hover:bg-white/5" aria-label="关闭弹窗"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-2"><span className="text-sm font-semibold text-slate-200">{label}</span>{children}</label>;
}

function StatusBadge({ status }: { status: string }) {
  return <span className={clsx("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold", getStatusTone(status))}>{getStatusLabel(status)}</span>;
}

function UsageProgress({ cdk }: { cdk: Cdk }) {
  const ratio = getUsageRatio(cdk);
  const tone = getUsageTone(cdk);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs"><span className={tone.text}>{cdk.remainingUses}/{cdk.maxUses}</span><span className="text-slate-500">{ratio}%</span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className={clsx("h-full rounded-full", tone.bar)} style={{ width: `${ratio}%` }} /></div>
    </div>
  );
}

function ExpiryBadge({ cdk, now }: { cdk: Cdk; now: number }) {
  if (!cdk.validUntil) return <span className="text-slate-500">未激活</span>;
  const expired = new Date(cdk.validUntil).getTime() <= now;
  const soon = isExpiringSoon(cdk, now);
  return <span className={clsx("inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", expired ? "border-rose-400/20 bg-rose-400/10 text-rose-200" : soon ? "border-amber-400/20 bg-amber-400/10 text-amber-200" : "border-white/10 bg-white/5 text-slate-300")}>{formatDateTime(cdk.validUntil)}</span>;
}

function EmptyState({ icon, title, description, actionLabel, onAction }: { icon: ReactNode; title: string; description: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/40 p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200">{icon}</div>
      <h3 className="mt-4 text-base font-bold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      {actionLabel && onAction && <button type="button" onClick={onAction} className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400/15 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/25"><Plus className="h-4 w-4" />{actionLabel}</button>}
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2"><p className="text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-100">{value}</p></div>;
}

function SummaryTile({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"><p className="flex items-center gap-2 text-xs text-slate-500">{icon}{label}</p><p className="mt-2 text-lg font-bold text-white">{value}</p></div>;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getFilterLabel(filter: StatusFilter) {
  return { ALL: "全部", ACTIVE: "启用", DISABLED: "停用" }[filter];
}

function getCdkDisplayCode(cdk: Cdk) {
  return cdk.code || `旧数据-${cdk.displayCodeLast4}`;
}

function getBoundUserLabel(cdk: Cdk) {
  return cdk.redeemedByUser?.wechatName || cdk.redeemedByUser?.name || cdk.redeemedByUser?.email || cdk.redeemedByFingerprint || "未绑定";
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    ACTIVE: "启用",
    DISABLED: "停用",
    UNUSED: "未使用",
    EXHAUSTED: "已用尽",
    EXPIRED: "已过期",
    REVOKED: "已撤销",
    SUCCESS: "成功",
    FAILED: "失败",
    PENDING: "处理中",
  };
  return labels[status] || status;
}

function getStatusTone(status: string) {
  if (["ACTIVE", "SUCCESS"].includes(status)) return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  if (["UNUSED", "PENDING"].includes(status)) return "border-cyan-400/20 bg-cyan-400/10 text-cyan-200";
  if (["EXHAUSTED", "EXPIRED"].includes(status)) return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  if (["REVOKED", "FAILED", "DISABLED"].includes(status)) return "border-rose-400/20 bg-rose-400/10 text-rose-200";
  return "border-white/10 bg-white/5 text-slate-300";
}

function getUsageRatio(cdk: Cdk) {
  return Math.max(0, Math.min(100, Math.round((cdk.remainingUses / Math.max(cdk.maxUses, 1)) * 100)));
}

function getUsageTone(cdk: Cdk) {
  const ratio = getUsageRatio(cdk);
  if (ratio === 0) return { text: "text-rose-200", bar: "bg-rose-400" };
  if (ratio <= 50) return { text: "text-amber-200", bar: "bg-amber-400" };
  return { text: "text-emerald-200", bar: "bg-emerald-400" };
}

function isExpiringSoon(cdk: Cdk, now: number) {
  if (!cdk.validUntil || ["EXPIRED", "EXHAUSTED", "REVOKED"].includes(cdk.status)) return false;
  const expiresAt = new Date(cdk.validUntil).getTime();
  return expiresAt > now && expiresAt - now <= 3 * 24 * 60 * 60 * 1000;
}

function formatDateTime(value: string | Date | null) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}
