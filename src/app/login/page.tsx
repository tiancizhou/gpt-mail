import Link from "next/link";
import { LoginForm } from "@/components/ClientForms";

export default function LoginPage() {
  return (
    <main className="hud-page mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16 relative">
      <Link href="/" className="mb-8 text-sm text-cyan-400/70 transition-colors hover:text-cyan-300">返回首页</Link>
      <h1 className="mb-6 text-3xl font-bold text-cyan-300" style={{ textShadow: "0 0 20px rgba(34,211,238,0.4)" }}>登录</h1>
      <LoginForm />
    </main>
  );
}
