import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const ctx = await requireAccount();
  const dispositions = await prisma.disposition.findMany({
    where: { accountId: ctx.accountId },
    select: { id: true, label: true, behavior: true, kind: true },
    orderBy: [{ kind: "asc" }, { label: "asc" }],
  });
  return NextResponse.json(dispositions);
}
