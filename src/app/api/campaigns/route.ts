import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  prospectListIds: z.array(z.string()).optional(),
});

export async function GET() {
  const ctx = await requireAccount();

  const campaigns = await prisma.campaign.findMany({
    where: { accountId: ctx.accountId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { callAttempts: true } },
      prospectLists: {
        include: {
          prospectList: {
            select: { id: true, name: true, _count: { select: { prospects: true } } },
          },
        },
      },
    },
  });

  return NextResponse.json(campaigns);
}

export async function POST(req: Request) {
  const ctx = await requireAccount();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  const campaign = await prisma.campaign.create({
    data: {
      name: parsed.data.name,
      accountId: ctx.accountId,
      prospectLists: parsed.data.prospectListIds?.length
        ? {
            create: parsed.data.prospectListIds.map((id) => ({ prospectListId: id })),
          }
        : undefined,
    },
    include: {
      prospectLists: {
        include: { prospectList: { select: { id: true, name: true } } },
      },
    },
  });

  return NextResponse.json(campaign, { status: 201 });
}
