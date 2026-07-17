// @ts-nocheck — pending rewrite (schema migration lot 2)
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enqueueCallBatch, type CallJob } from "@/lib/queue/call-queue";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;
  const campaign = await prisma.campaign.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twilioSid: true, twilioToken: true, twilioPhone: true },
  });
  if (!user?.twilioSid || !user?.twilioToken || !user?.twilioPhone) {
    return NextResponse.json(
      { error: "Compte Twilio non configuré. Rendez-vous dans les paramètres." },
      { status: 400 }
    );
  }

  const contacts = await prisma.contact.findMany({
    where: {
      campaignId: id,
      status: { in: ["PENDING"] },
      bloctelBlocked: false,
      attemptCount: { lt: 5 },
    },
    select: { id: true, phone: true, attemptCount: true },
  });

  if (contacts.length === 0) {
    return NextResponse.json({ error: "Aucun contact éligible à appeler" }, { status: 400 });
  }

  if (contacts.length > 50) {
    const body = await req.json().catch(() => ({}));
    if (!body.confirmed) {
      return NextResponse.json(
        {
          warning: true,
          message: `Vous êtes sur le point de lancer ${contacts.length} appels simultanés. Confirmez avec { confirmed: true }.`,
          count: contacts.length,
        },
        { status: 200 }
      );
    }
  }

  const settings = campaign.settings as { maxParallel?: number };
  const rateLimitMs = Math.ceil(60000 / (settings.maxParallel ?? 10));

  const userId = session.user.id as string;
  const jobs: CallJob[] = contacts.map((c) => ({
    contactId: c.id,
    campaignId: id,
    userId,
    phone: c.phone,
    attemptNumber: c.attemptCount + 1,
  }));

  await enqueueCallBatch(jobs, rateLimitMs);

  await prisma.campaign.update({
    where: { id },
    data: { status: "RUNNING" },
  });

  return NextResponse.json({ queued: contacts.length });
}
