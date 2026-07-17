import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getBalance } from "@/lib/credits";

export async function GET() {
  const ctx = await requireAccount();

  const [balance, ledger] = await Promise.all([
    getBalance(ctx.accountId),
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

  return NextResponse.json({ balance, ledger });
}
