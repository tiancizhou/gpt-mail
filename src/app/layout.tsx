import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GPT 拼车管理",
  description: "GPT 拼车、CDK 和邮箱验证码管理系统",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
