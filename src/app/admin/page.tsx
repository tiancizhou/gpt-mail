import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { AdminDashboard } from "@/components/AdminDashboard";
import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== UserRole.ADMIN) redirect("/dashboard");

  const accounts = await prisma.gptAccount.findMany({
    where: { status: { not: "ARCHIVED" } },
    include: {
      _count: { select: { memberships: true, cdks: true } },
      cdks: {
        include: { redeemedByUser: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),transparent_34rem),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_30rem),linear-gradient(135deg,#020617_0%,#0f172a_100%)] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <AdminDashboard initialAccounts={accounts} />
      </div>
    </main>
  );
}
