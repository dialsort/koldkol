import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { DispositionBehavior } from "@/types";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAccount();
  const { id } = await params;
  const { label, behavior } = (await req.json()) as {
    label: string;
    behavior: DispositionBehavior;
  };

  const disp = await prisma.disposition.findUnique({
    where: { id, accountId: ctx.accountId },
    select: { kind: true },
  });
  if (!disp) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (disp.kind === "SYSTEM")
    return NextResponse.json({ error: "SYSTEM_IMMUTABLE" }, { status: 403 });

  const updated = await prisma.disposition.update({
    where: { id },
    data: { label: label.trim(), behavior },
    select: { id: true, label: true, behavior: true, kind: true },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAccount();
  const { id } = await params;

  const disp = await prisma.disposition.findUnique({
    where: { id, accountId: ctx.accountId },
    select: { kind: true },
  });
  if (!disp) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (disp.kind === "SYSTEM")
    return NextResponse.json({ error: "SYSTEM_IMMUTABLE" }, { status: 403 });

  await prisma.disposition.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
