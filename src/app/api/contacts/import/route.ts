// @ts-nocheck — pending rewrite (schema migration lot 2)
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseCSV, applyMapping, type ColumnMapping } from "@/lib/csv/parser";
import { validateContacts } from "@/lib/csv/validator";
import { checkBloctel } from "@/lib/bloctel";
import { z } from "zod";

const bodySchema = z.object({
  campaignId: z.string(),
  csvContent: z.string(),
  mapping: z.object({
    firstName: z.string(),
    lastName: z.string(),
    phone: z.string(),
    email: z.string().optional(),
    company: z.string().optional(),
  }),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  const { campaignId, csvContent, mapping } = parsed.data;

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, userId: session.user.id },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });
  }

  const { rows, errors: parseErrors } = parseCSV(csvContent);
  const mapped = applyMapping(rows, mapping as ColumnMapping);
  const { valid, invalid } = validateContacts(mapped);

  const bloctelResults = await checkBloctel(valid.map((c) => c.phone));
  const bloctelBlocked = new Set(bloctelResults.filter((r) => r.blocked).map((r) => r.phone));

  const contactsData = valid.map((c) => ({
    firstName: c.firstName,
    lastName: c.lastName,
    phone: c.phone,
    email: c.email,
    company: c.company,
    campaignId,
    bloctelChecked: true,
    bloctelBlocked: bloctelBlocked.has(c.phone),
    status: bloctelBlocked.has(c.phone) ? ("BLOCKED" as const) : ("PENDING" as const),
  }));

  const created = await prisma.contact.createMany({
    data: contactsData,
    skipDuplicates: true,
  });

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { totalContacts: { increment: created.count } },
  });

  return NextResponse.json({
    imported: created.count,
    blocked: bloctelBlocked.size,
    invalid: invalid.length,
    parseErrors,
    invalidSample: invalid.slice(0, 10),
  });
}
