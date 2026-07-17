"use server";

import { requireAccount } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getBillingData() {
  const ctx = await requireAccount();
  const account = await prisma.account.findUniqueOrThrow({
    where: { id: ctx.accountId },
    select: {
      plan: true,
      billingCycle: true,
      extraCreditsMonthly: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      stripeSubscriptionStatus: true,
    },
  });
  const agg = await prisma.creditLedger.aggregate({
    where: { accountId: ctx.accountId },
    _sum: { delta: true },
  });
  const recentTransactions = await prisma.creditLedger.findMany({
    where: { accountId: ctx.accountId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, delta: true, reason: true, createdAt: true },
  });

  return {
    plan: account.plan,
    billingCycle: account.billingCycle,
    extraCreditsMonthly: account.extraCreditsMonthly,
    hasSubscription: !!account.stripeSubscriptionId,
    subscriptionStatus: account.stripeSubscriptionStatus ?? null,
    creditBalance: agg._sum.delta ?? 0,
    recentTransactions: recentTransactions.map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}

export async function revalidateBilling() {
  await requireAccount();
  revalidatePath("/app/billing");
}
