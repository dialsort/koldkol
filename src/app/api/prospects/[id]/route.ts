import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAccount();
  const { id } = await params;

  const prospect = await prisma.prospect.findUnique({
    where: { id, accountId: ctx.accountId },
    select: {
      id: true,
      company: true,
      contactName: true,
      phoneNumber: true,
      status: true,
      excludedAt: true,
      createdAt: true,
      list: { select: { name: true, legalBasis: true } },
      tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
      notes: {
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      callAttempts: {
        select: {
          id: true,
          startedAt: true,
          slot: true,
          result: true,
          durationSec: true,
          callbackAt: true,
          disposition: { select: { id: true, label: true, behavior: true } },
        },
        orderBy: { startedAt: "desc" },
      },
    },
  });

  if (!prospect) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Include all account tags for the tag selector
  const allTags = await prisma.tag.findMany({
    where: { accountId: ctx.accountId },
    select: { id: true, name: true, color: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ prospect, allTags });
}
