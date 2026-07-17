import { prisma } from "@/lib/prisma";
import { PLAN_CONFIG } from "@/lib/plan-config";

export async function getBalance(accountId: string): Promise<number> {
  const agg = await prisma.creditLedger.aggregate({
    where: { accountId },
    _sum: { delta: true },
  });
  return agg._sum.delta ?? 0;
}

export async function hasSufficientCredits(accountId: string, amount: number): Promise<boolean> {
  const balance = await getBalance(accountId);
  return balance >= amount;
}

export async function grant(accountId: string, amount: number, reason: string): Promise<void> {
  await prisma.creditLedger.create({
    data: { accountId, delta: amount, reason },
  });
}

/**
 * Deduct `amount` credits atomically. Throws "INSUFFICIENT_CREDITS" if balance
 * would go negative. When `callAttemptId` is provided, also increments
 * creditsCharged on the attempt row so per-call tracking stays accurate.
 */
export async function charge(
  accountId: string,
  amount: number,
  reason: string,
  callAttemptId?: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const agg = await tx.creditLedger.aggregate({
      where: { accountId },
      _sum: { delta: true },
    });
    const balance = agg._sum.delta ?? 0;
    if (balance < amount) throw new Error("INSUFFICIENT_CREDITS");

    await tx.creditLedger.create({
      data: { accountId, delta: -amount, reason, relatedCallAttemptId: callAttemptId },
    });

    if (callAttemptId) {
      await tx.callAttempt.update({
        where: { id: callAttemptId },
        data: { creditsCharged: { increment: amount } },
      });
    }
  });
}

/**
 * Monthly plan reset:
 *  1. Expire unused plan credits from the previous cycle.
 *  2. Grant this cycle's monthly credits.
 *
 * "Unused plan credits" = max(0, lastGrantDelta - totalChargesSinceLastGrant).
 * Purchased credits (CREDIT_PURCHASE entries) are not touched and persist.
 */
export async function performMonthlyPlanReset(accountId: string): Promise<void> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { plan: true },
  });
  if (!account) throw new Error("Account not found");

  const config = PLAN_CONFIG[account.plan];

  await prisma.$transaction(async (tx) => {
    const lastGrant = await tx.creditLedger.findFirst({
      where: { accountId, reason: "PLAN_MONTHLY_GRANT" },
      orderBy: { createdAt: "desc" },
    });

    if (lastGrant) {
      const chargeAgg = await tx.creditLedger.aggregate({
        where: { accountId, delta: { lt: 0 }, createdAt: { gt: lastGrant.createdAt } },
        _sum: { delta: true },
      });
      const totalCharged = Math.abs(chargeAgg._sum.delta ?? 0);
      const unusedPlanCredits = Math.max(0, lastGrant.delta - totalCharged);

      if (unusedPlanCredits > 0) {
        await tx.creditLedger.create({
          data: { accountId, delta: -unusedPlanCredits, reason: "PLAN_MONTHLY_EXPIRY" },
        });
      }
    }

    await tx.creditLedger.create({
      data: { accountId, delta: config.monthlyCredits, reason: "PLAN_MONTHLY_GRANT" },
    });
  });
}
