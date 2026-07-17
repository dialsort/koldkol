import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const ctx = await requireAccount();

  const prospects = await prisma.prospect.findMany({
    where: { accountId: ctx.accountId },
    select: {
      id: true,
      company: true,
      contactName: true,
      phoneNumber: true,
      status: true,
      createdAt: true,
      tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
      slotStats: { select: { attempts: true, humanAnswers: true } },
      callAttempts: {
        select: {
          id: true,
          startedAt: true,
          slot: true,
          result: true,
          disposition: { select: { id: true, label: true, behavior: true } },
        },
        orderBy: { startedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(prospects);
}
