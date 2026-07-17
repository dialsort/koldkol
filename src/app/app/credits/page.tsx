import { requireAccount } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getBalance } from "@/lib/credits";
import { PLAN_CONFIG } from "@/lib/plan-config";
import CreditsView from "./CreditsView";

export default async function CreditsPage() {
  const ctx = await requireAccount();

  const [balance, account, ledger] = await Promise.all([
    getBalance(ctx.accountId),
    prisma.account.findUniqueOrThrow({
      where: { id: ctx.accountId },
      select: { plan: true },
    }),
    prisma.creditLedger.findMany({
      where: { accountId: ctx.accountId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        delta: true,
        reason: true,
        relatedCallAttemptId: true,
        createdAt: true,
      },
    }),
  ]);

  const config = PLAN_CONFIG[account.plan];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Crédits</h1>
        <p className="mt-1 text-sm text-gray-500">
          Consultez votre solde et achetez des crédits supplémentaires.
        </p>
      </div>
      <CreditsView
        balance={balance}
        plan={account.plan}
        monthlyCredits={config.monthlyCredits}
        ledger={ledger.map((e) => ({
          ...e,
          createdAt: e.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
