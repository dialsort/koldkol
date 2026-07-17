"use server";

import { requireAccount } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function topUpCredits(
  amount: number
): Promise<{ ok: true; newBalance: number } | { ok: false; error: string }> {
  if (!Number.isInteger(amount) || amount < 1 || amount > 10000) {
    return { ok: false, error: "Montant invalide" };
  }
  const ctx = await requireAccount();

  await prisma.creditLedger.create({
    data: {
      accountId: ctx.accountId,
      delta: amount,
      reason: "MANUAL_TOP_UP",
    },
  });

  const agg = await prisma.creditLedger.aggregate({
    where: { accountId: ctx.accountId },
    _sum: { delta: true },
  });

  return { ok: true, newBalance: agg._sum.delta ?? 0 };
}

export async function getCreditBalance(): Promise<number> {
  const ctx = await requireAccount();
  const agg = await prisma.creditLedger.aggregate({
    where: { accountId: ctx.accountId },
    _sum: { delta: true },
  });
  return agg._sum.delta ?? 0;
}
