import { requireAccount } from "@/lib/session";
import { prisma } from "@/lib/prisma";

function esc(val: string | null | undefined, sep: string): string {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(sep) || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function row(fields: (string | number | null | undefined)[], sep: string): string {
  return fields.map((f) => esc(f == null ? "" : String(f), sep)).join(sep);
}

/**
 * GET /api/export/calls?sep=;
 *
 * Exports all call attempts for the current account as UTF-8 CSV with BOM.
 * Separator defaults to ";" (configurable via ?sep=,).
 */
export async function GET(request: Request) {
  const ctx = await requireAccount();
  const url = new URL(request.url);
  const sep = url.searchParams.get("sep") ?? ";";

  const attempts = await prisma.callAttempt.findMany({
    where: { accountId: ctx.accountId },
    select: {
      id: true,
      prospectId: true,
      slot: true,
      startedAt: true,
      durationSec: true,
      result: true,
      callbackAt: true,
      creditsCharged: true,
      prospect: { select: { company: true, contactName: true, phoneNumber: true } },
      campaign: { select: { name: true } },
      disposition: { select: { label: true } },
    },
    orderBy: { startedAt: "desc" },
  });

  const headers = [
    "id",
    "prospectId",
    "company",
    "contactName",
    "phoneNumber",
    "campaign",
    "slot",
    "startedAt",
    "durationSec",
    "result",
    "disposition",
    "callbackAt",
    "creditsCharged",
  ];

  const lines: string[] = [row(headers, sep)];

  for (const a of attempts) {
    lines.push(
      row(
        [
          a.id,
          a.prospectId,
          a.prospect.company,
          a.prospect.contactName,
          a.prospect.phoneNumber,
          a.campaign.name,
          a.slot,
          a.startedAt.toISOString(),
          a.durationSec,
          a.result,
          a.disposition?.label,
          a.callbackAt?.toISOString(),
          a.creditsCharged,
        ],
        sep
      )
    );
  }

  const date = new Date().toISOString().slice(0, 10);
  const csv = "﻿" + lines.join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="appels_${date}.csv"`,
    },
  });
}
