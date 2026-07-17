import { requireAccount } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const SLOTS = ["MATIN", "DEBUT_APREM", "FIN_APREM"] as const;

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
 * GET /api/export/prospects?sep=;
 *
 * Exports all prospects for the current account as UTF-8 CSV with BOM (Excel FR
 * compatible). Includes tags, last disposition, per-slot scores, and total
 * attempt count. Separator defaults to ";" (configurable via ?sep=,).
 */
export async function GET(request: Request) {
  const ctx = await requireAccount();
  const url = new URL(request.url);
  const sep = url.searchParams.get("sep") ?? ";";

  const prospects = await prisma.prospect.findMany({
    where: { accountId: ctx.accountId },
    select: {
      id: true,
      company: true,
      contactName: true,
      phoneNumber: true,
      status: true,
      createdAt: true,
      list: {
        select: { name: true, legalBasis: true, legalBasisDeclaredAt: true, importedAt: true },
      },
      tags: { select: { tag: { select: { name: true } } } },
      slotStats: { select: { slot: true, attempts: true, humanAnswers: true } },
      _count: { select: { callAttempts: true } },
      callAttempts: {
        select: {
          result: true,
          disposition: { select: { label: true } },
        },
        orderBy: { startedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const headers = [
    "id",
    "company",
    "contactName",
    "phoneNumber",
    "status",
    "tags",
    "totalAttempts",
    "lastResult",
    "lastDisposition",
    // per-slot
    "attempts_MATIN",
    "humanAnswers_MATIN",
    "score_MATIN",
    "attempts_DEBUT_APREM",
    "humanAnswers_DEBUT_APREM",
    "score_DEBUT_APREM",
    "attempts_FIN_APREM",
    "humanAnswers_FIN_APREM",
    "score_FIN_APREM",
    "createdAt",
    // legal basis traceability (GDPR / CNIL)
    "prospectListName",
    "legalBasis",
    "legalBasisDeclaredAt",
    "listImportedAt",
  ];

  const lines: string[] = [row(headers, sep)];

  for (const p of prospects) {
    const tags = p.tags.map((t) => t.tag.name).join("|");
    const last = p.callAttempts[0];
    const slotCols: (string | number)[] = [];
    for (const slot of SLOTS) {
      const stat = p.slotStats.find((s) => s.slot === slot);
      const attempts = stat?.attempts ?? 0;
      const humanAnswers = stat?.humanAnswers ?? 0;
      const score = attempts === 0 ? "" : ((humanAnswers / attempts) * 100).toFixed(1) + "%";
      slotCols.push(attempts, humanAnswers, score);
    }

    lines.push(
      row(
        [
          p.id,
          p.company,
          p.contactName,
          p.phoneNumber,
          p.status,
          tags,
          p._count.callAttempts,
          last?.result ?? "",
          last?.disposition?.label ?? "",
          ...slotCols,
          p.createdAt.toISOString(),
          p.list.name,
          p.list.legalBasis,
          p.list.legalBasisDeclaredAt.toISOString(),
          p.list.importedAt.toISOString(),
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
      "Content-Disposition": `attachment; filename="prospects_${date}.csv"`,
    },
  });
}
