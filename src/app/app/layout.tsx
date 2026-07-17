import { requireAccount } from "@/lib/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import RadialDock from "@/components/ui/RadialDock";
import NavLinks from "./NavLinks";
import NavigationProgress from "./NavigationProgress";
import { CallProvider } from "@/contexts/CallContext";
import { prisma } from "@/lib/prisma";
import CreditBadge from "./CreditBadge";
import TwilioBalanceBadge from "./TwilioBalanceBadge";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let ctx: Awaited<ReturnType<typeof requireAccount>>;
  try {
    ctx = await requireAccount();
  } catch {
    redirect("/login");
  }

  const initials = ctx.role.slice(0, 2).toUpperCase();

  const [account, creditAgg] = await Promise.all([
    prisma.account.findUniqueOrThrow({ where: { id: ctx.accountId }, select: { plan: true } }),
    prisma.creditLedger.aggregate({ where: { accountId: ctx.accountId }, _sum: { delta: true } }),
  ]);
  const creditBalance = creditAgg._sum.delta ?? 0;

  const campaigns = await prisma.campaign.findMany({
    where: { accountId: ctx.accountId, status: { in: ["ACTIVE", "PAUSED"] } },
    select: { id: true, name: true, status: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-[#f7f7f8]">
      <NavigationProgress />
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-gray-200/60 bg-white/92 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-14 items-center gap-6">
            {/* Logo */}
            <Link href="/app" className="flex items-center gap-2 group shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="KoldKol"
                width={32}
                height={32}
                className="rounded-lg transition-all duration-300 group-hover:scale-105 group-hover:shadow-md group-hover:shadow-red-200"
              />
              <span className="text-sm font-bold tracking-tight text-gray-900">KoldKol</span>
            </Link>

            {/* Nav links */}
            <NavLinks />

            {/* Right side */}
            <div className="flex items-center gap-3 ml-auto">
              <TwilioBalanceBadge />
              <CreditBadge initialBalance={creditBalance} plan={account.plan} />
              <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-1.5">
                <div className="h-5 w-5 rounded-full bg-red-100 border border-red-200 flex items-center justify-center">
                  <span className="text-[9px] font-bold text-red-600">{initials}</span>
                </div>
                <span className="text-xs font-medium text-gray-500 hidden sm:block">{ctx.role}</span>
              </div>
              <Link
                href="/logout"
                className="text-xs text-gray-400 hover:text-gray-700 transition-colors font-medium px-2 py-1"
              >
                Déconnexion
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <CallProvider initialCampaigns={campaigns}>
        <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8 pb-32">{children}</main>
        <RadialDock />
      </CallProvider>
    </div>
  );
}
