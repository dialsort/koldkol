// @ts-nocheck — pending rewrite (schema migration lot 2)
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Papa from "papaparse";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  REACHABLE: "Joignable",
  UNREACHABLE: "Injoignable",
  INVALID: "Faux numéro",
  BLOCKED: "Bloctel",
  CALLING: "En cours",
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const contacts = await prisma.contact.findMany({
    where: { campaignId: id },
    orderBy: [{ status: "asc" }, { lastName: "asc" }],
    include: {
      callAttempts: { orderBy: { calledAt: "asc" } },
    },
  });

  const rows = contacts.map((c) => ({
    Prénom: c.firstName,
    Nom: c.lastName,
    Téléphone: c.phone,
    Email: c.email ?? "",
    Société: c.company ?? "",
    Statut: STATUS_LABELS[c.status] ?? c.status,
    "Meilleure heure": c.bestHour != null ? `${c.bestHour}h` : "",
    Tentatives: c.attemptCount,
    "Dernier appel": c.callAttempts.at(-1)?.calledAt?.toISOString().slice(0, 16) ?? "",
  }));

  const csv = Papa.unparse(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="koldkol-${campaign.name.replace(/\s+/g, "_")}.csv"`,
    },
  });
}
