import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAccount();
  const { id } = await params;

  const attempt = await prisma.callAttempt.findUnique({
    where: { id, accountId: ctx.accountId },
    select: { id: true, result: true, slot: true, startedAt: true, prospectId: true },
  });
  if (!attempt) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json(attempt);
}
