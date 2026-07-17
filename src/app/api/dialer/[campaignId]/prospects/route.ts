import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ campaignId: string }> }) {
  const ctx = await requireAccount();
  const { campaignId } = await params;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId, accountId: ctx.accountId },
    select: { prospectLists: { select: { prospectListId: true } } },
  });
  if (!campaign) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const listIds = campaign.prospectLists.map((pl) => pl.prospectListId);

  const prospects = await prisma.prospect.findMany({
    where: {
      accountId: ctx.accountId,
      listId: { in: listIds },
      status: "ACTIVE",
      ...(q
        ? {
            OR: [
              { contactName: { contains: q, mode: "insensitive" } },
              { company: { contains: q, mode: "insensitive" } },
              { phoneNumber: { contains: q } },
            ],
          }
        : {}),
    },
    select: { id: true, contactName: true, company: true, phoneNumber: true },
    orderBy: [{ contactName: "asc" }, { company: "asc" }],
    take: 15,
  });

  return NextResponse.json({ prospects });
}
