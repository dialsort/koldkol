// @ts-nocheck — pending rewrite (schema migration lot 2)
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getCampaignForUser(id: string, userId: string) {
  return prisma.campaign.findFirst({ where: { id, userId } });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;
  const campaign = await getCampaignForUser(id, session.user.id);
  if (!campaign) {
    return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });
  }

  const stats = await prisma.contact.groupBy({
    by: ["status"],
    where: { campaignId: id },
    _count: true,
  });

  return NextResponse.json({
    ...campaign,
    stats: Object.fromEntries(stats.map((s) => [s.status, s._count])),
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;
  const campaign = await getCampaignForUser(id, session.user.id);
  if (!campaign) {
    return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });
  }

  const body = await req.json();
  const updated = await prisma.campaign.update({
    where: { id },
    data: {
      ...(body.name && { name: body.name }),
      ...(body.status && { status: body.status }),
      ...(body.settings && { settings: body.settings }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;
  const campaign = await getCampaignForUser(id, session.user.id);
  if (!campaign) {
    return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });
  }

  await prisma.campaign.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
