"use server";

import { requireAccount } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export type ImportRow = {
  phoneNumber: string;
  company?: string;
  contactName?: string;
};

export type ImportResult = {
  ok: boolean;
  imported: number;
  skipped: number;
  message: string;
};

function normalizePhone(raw: string): string | null {
  const s = raw.replace(/[\s.\-()]/g, "");
  if (s.startsWith("+33") && s.length >= 12) return s;
  if (s.startsWith("0033") && s.length >= 13) return "+" + s.slice(2);
  if (s.startsWith("0") && s.length === 10) return "+33" + s.slice(1);
  if (s.startsWith("+") && s.length >= 10) return s;
  return null;
}

export async function importProspects(
  rows: ImportRow[],
  listName: string
): Promise<ImportResult> {
  const ctx = await requireAccount();

  const list = await prisma.prospectList.create({
    data: {
      accountId: ctx.accountId,
      name: listName,
      legalBasis: "legitimate_interest",
      legalBasisDeclaredAt: new Date(),
    },
  });

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const phone = normalizePhone(row.phoneNumber);
    if (!phone) {
      skipped++;
      continue;
    }
    try {
      await prisma.prospect.create({
        data: {
          accountId: ctx.accountId,
          listId: list.id,
          phoneNumber: phone,
          company: row.company || null,
          contactName: row.contactName || null,
        },
      });
      imported++;
    } catch (e: unknown) {
      if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
        skipped++;
      } else {
        throw e;
      }
    }
  }

  return {
    ok: true,
    imported,
    skipped,
    message:
      `${imported} prospect${imported !== 1 ? "s" : ""} importé${imported !== 1 ? "s" : ""}` +
      (skipped > 0
        ? `, ${skipped} ignoré${skipped !== 1 ? "s" : ""} (doublon ou numéro invalide)`
        : ""),
  };
}
