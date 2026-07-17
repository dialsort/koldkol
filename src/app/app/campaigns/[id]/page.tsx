import { requireAccount } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import CampaignDetailClient from "./CampaignDetailClient";

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  PAUSED: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-gray-100 text-gray-600",
};
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  PAUSED: "Suspendue",
  COMPLETED: "Terminée",
};

const RESULT_LABEL: Record<string, string> = {
  HUMAN_ANSWERED: "Décroché",
  ANSWERED_NOT_TAKEN: "Non pris",
  VOICEMAIL: "Répondeur",
  NO_ANSWER: "Pas de réponse",
  INVALID_NUMBER: "Numéro invalide",
  FAILED: "Échec technique",
};
const RESULT_STYLE: Record<string, string> = {
  HUMAN_ANSWERED: "bg-green-100 text-green-700",
  ANSWERED_NOT_TAKEN: "bg-amber-100 text-amber-700",
  VOICEMAIL: "bg-gray-100 text-gray-500",
  NO_ANSWER: "bg-gray-100 text-gray-500",
  INVALID_NUMBER: "bg-red-50 text-red-600",
  FAILED: "bg-red-50 text-red-500",
};

const SLOT_LABEL: Record<string, string> = {
  MATIN: "Matin",
  DEBUT_APREM: "Début d'AM",
  FIN_APREM: "Fin d'AM",
};
const SLOT_ORDER = ["MATIN", "DEBUT_APREM", "FIN_APREM"];

// Priority for "best outcome" per prospect (higher = better)
const RESULT_PRIORITY: Record<string, number> = {
  HUMAN_ANSWERED: 6,
  ANSWERED_NOT_TAKEN: 5,
  VOICEMAIL: 4,
  NO_ANSWER: 3,
  INVALID_NUMBER: 2, // more informative than a generic FAILED
  FAILED: 1,
};

function fmt(sec: number | null) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

type ProspectRow = {
  id: string;
  contactName: string | null;
  company: string | null;
  phoneNumber: string;
};

type ProspectOutcome = {
  prospect: ProspectRow;
  result: string;
  answeredSlots: string[]; // distinct slots where HUMAN_ANSWERED
};

function displayName(p: ProspectRow) {
  return p.contactName ?? p.company ?? p.phoneNumber;
}

function ProspectCard({ p }: { p: ProspectOutcome }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{displayName(p.prospect)}</p>
        {(p.prospect.contactName ?? p.prospect.company) && (
          <p className="text-xs text-gray-400">{p.prospect.phoneNumber}</p>
        )}
      </div>
      {p.answeredSlots.length > 0 && (
        <div className="flex gap-1 shrink-0">
          {SLOT_ORDER.filter((s) => p.answeredSlots.includes(s)).map((s) => (
            <span key={s} className="rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-xs text-green-700">
              {SLOT_LABEL[s]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function BilanGroup({
  title,
  count,
  color,
  icon,
  children,
}: {
  title: string;
  count: number;
  color: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border overflow-hidden ${color}`}>
      <div className="flex items-center gap-3 px-5 py-3 border-b border-inherit">
        <span className="text-lg">{icon}</span>
        <h3 className="font-semibold text-gray-800 flex-1">{title}</h3>
        <span className="text-sm font-semibold text-gray-600">{count} prospect{count !== 1 ? "s" : ""}</span>
      </div>
      <div className="px-5 divide-y divide-gray-100/60">
        {children}
      </div>
    </div>
  );
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireAccount();
  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id, accountId: ctx.accountId },
    include: {
      prospectLists: {
        include: {
          prospectList: {
            select: {
              id: true,
              name: true,
              sourceFileName: true,
              _count: { select: { prospects: true } },
            },
          },
        },
      },
    },
  });

  if (!campaign) notFound();

  const [resultStats, recentAttempts] = await Promise.all([
    prisma.callAttempt.groupBy({
      by: ["result"],
      where: { campaignId: id, accountId: ctx.accountId },
      _count: { result: true },
    }),
    campaign.status !== "COMPLETED"
      ? prisma.callAttempt.findMany({
          where: { campaignId: id, accountId: ctx.accountId },
          orderBy: { startedAt: "desc" },
          take: 30,
          select: {
            id: true,
            startedAt: true,
            durationSec: true,
            result: true,
            slot: true,
            prospect: { select: { id: true, contactName: true, company: true, phoneNumber: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const statsByResult = Object.fromEntries(
    resultStats.map((r) => [r.result ?? "PENDING", r._count.result])
  );
  const totalAttempts = resultStats.reduce((s, r) => s + r._count.result, 0);
  const humanAnswered = statsByResult["HUMAN_ANSWERED"] ?? 0;
  const pending = campaign.status !== "COMPLETED"
    ? await prisma.callAttempt.count({ where: { campaignId: id, accountId: ctx.accountId, result: null } })
    : 0;

  const totalProspects = campaign.prospectLists.reduce(
    (s, pl) => s + pl.prospectList._count.prospects,
    0
  );

  // ── Bilan segmentation (only for COMPLETED) ──────────────────────────────
  let bilan: {
    answered: ProspectOutcome[];
    bySlot: Record<string, ProspectOutcome[]>;
    voicemail: ProspectOutcome[];
    noAnswer: ProspectOutcome[];
    invalidNumber: ProspectOutcome[];
    notCalled: ProspectRow[];
  } | null = null;

  if (campaign.status === "COMPLETED") {
    const listIds = campaign.prospectLists.map((pl) => pl.prospectList.id);

    const [allProspects, allAttempts] = await Promise.all([
      prisma.prospect.findMany({
        where: { listId: { in: listIds }, accountId: ctx.accountId },
        select: { id: true, contactName: true, company: true, phoneNumber: true },
        orderBy: [{ contactName: "asc" }, { company: "asc" }],
      }),
      prisma.callAttempt.findMany({
        where: { campaignId: id, accountId: ctx.accountId, result: { not: null } },
        select: { prospectId: true, result: true, slot: true },
      }),
    ]);

    // Build best-outcome map per prospect
    const outcomeMap = new Map<string, { result: string; answeredSlots: string[] }>();

    for (const a of allAttempts) {
      if (!a.result) continue;
      const existing = outcomeMap.get(a.prospectId);
      const priority = RESULT_PRIORITY[a.result] ?? 0;
      const existingPriority = existing ? (RESULT_PRIORITY[existing.result] ?? 0) : 0;

      if (!existing) {
        outcomeMap.set(a.prospectId, {
          result: a.result,
          answeredSlots: a.result === "HUMAN_ANSWERED" ? [a.slot] : [],
        });
      } else if (priority > existingPriority) {
        outcomeMap.set(a.prospectId, {
          result: a.result,
          answeredSlots: a.result === "HUMAN_ANSWERED" ? [a.slot] : [],
        });
      } else if (a.result === "HUMAN_ANSWERED" && existing.result === "HUMAN_ANSWERED") {
        if (!existing.answeredSlots.includes(a.slot)) {
          existing.answeredSlots.push(a.slot);
        }
      }
    }

    const answered: ProspectOutcome[] = [];
    const voicemail: ProspectOutcome[] = [];
    const noAnswer: ProspectOutcome[] = [];
    const invalidNumber: ProspectOutcome[] = [];
    const notCalled: ProspectRow[] = [];

    for (const p of allProspects) {
      const outcome = outcomeMap.get(p.id);
      if (!outcome) {
        notCalled.push(p);
        continue;
      }
      const row: ProspectOutcome = { prospect: p, result: outcome.result, answeredSlots: outcome.answeredSlots };
      if (outcome.result === "HUMAN_ANSWERED" || outcome.result === "ANSWERED_NOT_TAKEN") {
        answered.push(row);
      } else if (outcome.result === "VOICEMAIL") {
        voicemail.push(row);
      } else if (outcome.result === "INVALID_NUMBER") {
        invalidNumber.push(row);
      } else {
        noAnswer.push(row);
      }
    }

    // Group answered prospects by their answering slots
    const bySlot: Record<string, ProspectOutcome[]> = {
      MATIN: [],
      DEBUT_APREM: [],
      FIN_APREM: [],
      MULTIPLE: [],
    };
    for (const row of answered) {
      if (row.answeredSlots.length > 1) {
        bySlot.MULTIPLE.push(row);
      } else if (row.answeredSlots.length === 1) {
        bySlot[row.answeredSlots[0]].push(row);
      } else {
        bySlot.MULTIPLE.push(row); // ANSWERED_NOT_TAKEN — no slot preference
      }
    }

    bilan = { answered, bySlot, voicemail, noAnswer, invalidNumber, notCalled };
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link
          href="/app/campaigns"
          className="mt-0.5 shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors"
        >
          ← Retour
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{campaign.name}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[campaign.status] ?? "bg-gray-100 text-gray-600"}`}>
              {STATUS_LABEL[campaign.status] ?? campaign.status}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-gray-400">
            Créée le {new Date(campaign.createdAt).toLocaleDateString("fr-FR")}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {campaign.status !== "COMPLETED" && (
            <Link
              href={`/app/session?campaignId=${campaign.id}`}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors shadow-sm"
            >
              Appeler →
            </Link>
          )}
          <CampaignDetailClient campaignId={campaign.id} initialStatus={campaign.status} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Appels total",
            value: totalAttempts + pending,
            sub: pending > 0 ? `dont ${pending} en cours` : undefined,
          },
          {
            label: "Décrochés",
            value: humanAnswered,
            sub: totalAttempts > 0
              ? `${Math.round((humanAnswered / (totalAttempts + pending)) * 100)} %`
              : "—",
          },
          { label: "Répondeurs", value: statsByResult["VOICEMAIL"] ?? 0 },
          {
            label: "Sans réponse",
            value: (statsByResult["NO_ANSWER"] ?? 0) + (statsByResult["FAILED"] ?? 0) + (statsByResult["INVALID_NUMBER"] ?? 0),
            sub: (statsByResult["INVALID_NUMBER"] ?? 0) > 0
              ? `dont ${statsByResult["INVALID_NUMBER"]} numéro${(statsByResult["INVALID_NUMBER"] ?? 0) > 1 ? "s" : ""} invalide${(statsByResult["INVALID_NUMBER"] ?? 0) > 1 ? "s" : ""}`
              : undefined,
          },
        ].map(({ label, value, sub }) => (
          <div key={label} className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Prospect lists */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="font-semibold text-gray-800">
            Listes associées
            <span className="ml-2 text-sm font-normal text-gray-400">
              ({campaign.prospectLists.length} liste{campaign.prospectLists.length !== 1 ? "s" : ""} · {totalProspects} prospect{totalProspects !== 1 ? "s" : ""})
            </span>
          </h2>
        </div>
        {campaign.prospectLists.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">Aucune liste associée.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {campaign.prospectLists.map(({ prospectList: pl }) => (
              <div key={pl.id} className="flex items-center gap-3 px-5 py-3">
                <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{pl.name}</p>
                  {pl.sourceFileName && <p className="text-xs text-gray-400 truncate">{pl.sourceFileName}</p>}
                </div>
                <span className="text-sm font-semibold text-gray-700">
                  {pl._count.prospects} prospect{pl._count.prospects !== 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── BILAN (campagne terminée) ───────────────────────────────────────── */}
      {bilan && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Bilan des prospects</h2>

          {/* Ont décroché */}
          <BilanGroup
            title="Ont décroché"
            count={bilan.answered.length}
            color="border-green-200 bg-green-50/40"
            icon="✅"
          >
            {bilan.answered.length === 0 ? (
              <p className="py-4 text-sm text-gray-400 text-center">Aucun prospect décroché.</p>
            ) : (
              <>
                {SLOT_ORDER.filter((s) => bilan!.bySlot[s].length > 0).map((slot) => (
                  <div key={slot}>
                    <p className="pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-green-700">
                      {slot === "MATIN" ? "Matin (10h–13h)" : slot === "DEBUT_APREM" ? "Début d'après-midi (14h–17h)" : "Fin d'après-midi (17h–20h)"}
                      <span className="ml-1.5 font-normal text-green-600 normal-case tracking-normal">
                        — {bilan!.bySlot[slot].length} prospect{bilan!.bySlot[slot].length !== 1 ? "s" : ""}
                      </span>
                    </p>
                    {bilan!.bySlot[slot].map((p) => (
                      <ProspectCard key={p.prospect.id} p={p} />
                    ))}
                  </div>
                ))}
                {bilan.bySlot.MULTIPLE.length > 0 && (
                  <div>
                    <p className="pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-green-700">
                      Plusieurs créneaux
                      <span className="ml-1.5 font-normal text-green-600 normal-case tracking-normal">
                        — {bilan.bySlot.MULTIPLE.length} prospect{bilan.bySlot.MULTIPLE.length !== 1 ? "s" : ""}
                      </span>
                    </p>
                    {bilan.bySlot.MULTIPLE.map((p) => (
                      <ProspectCard key={p.prospect.id} p={p} />
                    ))}
                  </div>
                )}
              </>
            )}
          </BilanGroup>

          {/* Répondeur */}
          <BilanGroup
            title="Répondeur détecté"
            count={bilan.voicemail.length}
            color="border-gray-200 bg-gray-50/40"
            icon="📱"
          >
            {bilan.voicemail.length === 0 ? (
              <p className="py-4 text-sm text-gray-400 text-center">Aucun répondeur détecté.</p>
            ) : (
              bilan.voicemail.map((p) => <ProspectCard key={p.prospect.id} p={p} />)
            )}
          </BilanGroup>

          {/* Pas de réponse */}
          <BilanGroup
            title="Pas de réponse"
            count={bilan.noAnswer.length}
            color="border-gray-200 bg-gray-50/40"
            icon="📵"
          >
            {bilan.noAnswer.length === 0 ? (
              <p className="py-4 text-sm text-gray-400 text-center">Aucun.</p>
            ) : (
              bilan.noAnswer.map((p) => (
                <div key={p.prospect.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{displayName(p.prospect)}</p>
                    {(p.prospect.contactName ?? p.prospect.company) && (
                      <p className="text-xs text-gray-400">{p.prospect.phoneNumber}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </BilanGroup>

          {/* Numéro invalide / hors service */}
          {bilan.invalidNumber.length > 0 && (
            <BilanGroup
              title="Numéro invalide ou hors service"
              count={bilan.invalidNumber.length}
              color="border-red-200 bg-red-50/40"
              icon="🚫"
            >
              {bilan.invalidNumber.map((p) => (
                <div key={p.prospect.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{displayName(p.prospect)}</p>
                    <p className="text-xs text-red-400">{p.prospect.phoneNumber} — numéro inexistant ou résilié</p>
                  </div>
                </div>
              ))}
            </BilanGroup>
          )}

          {/* Non appelés */}
          {bilan.notCalled.length > 0 && (
            <BilanGroup
              title="Non appelés"
              count={bilan.notCalled.length}
              color="border-amber-200 bg-amber-50/40"
              icon="⏭️"
            >
              {bilan.notCalled.map((p) => (
                <div key={p.id} className="py-2.5">
                  <p className="text-sm font-medium text-gray-800 truncate">{displayName(p)}</p>
                  {(p.contactName ?? p.company) && (
                    <p className="text-xs text-gray-400">{p.phoneNumber}</p>
                  )}
                </div>
              ))}
            </BilanGroup>
          )}
        </div>
      )}

      {/* ── Historique (campagne non terminée) ─────────────────────────────── */}
      {campaign.status !== "COMPLETED" && (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-3">
            <h2 className="font-semibold text-gray-800">
              Historique des appels
              <span className="ml-2 text-sm font-normal text-gray-400">(30 derniers)</span>
            </h2>
          </div>
          {recentAttempts.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">Aucun appel effectué pour cette campagne.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-400">Date</th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-400">Prospect</th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-400">Créneau</th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-400">Résultat</th>
                    <th className="px-5 py-2.5 text-right text-xs font-medium text-gray-400">Durée</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentAttempts.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(a.startedAt).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-800 truncate max-w-[180px]">
                          {a.prospect.contactName ?? a.prospect.company ?? a.prospect.phoneNumber}
                        </p>
                        {(a.prospect.contactName ?? a.prospect.company) && (
                          <p className="text-xs text-gray-400">{a.prospect.phoneNumber}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                        {SLOT_LABEL[a.slot] ?? a.slot}
                      </td>
                      <td className="px-5 py-3">
                        {a.result ? (
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${RESULT_STYLE[a.result] ?? "bg-gray-100 text-gray-500"}`}>
                            {RESULT_LABEL[a.result] ?? a.result}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-600">
                            En cours
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-500 whitespace-nowrap">
                        {fmt(a.durationSec ?? null)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
