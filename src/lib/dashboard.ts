import { prisma } from "@/lib/prisma";
import { computeScore } from "@/lib/scoring";
import { getCurrentSlot, isWithinLegalWindow, nextLegalWindow } from "@/lib/slots";
import type { CallResult, Slot } from "@/types";

export const SLOTS: Slot[] = ["MATIN", "DEBUT_APREM", "FIN_APREM"];

export const SLOT_LABEL: Record<Slot, string> = {
  MATIN: "Matin (10h–13h)",
  DEBUT_APREM: "Déb. ap.-midi (14h–17h)",
  FIN_APREM: "Fin ap.-midi (17h–20h)",
};

export const SLOT_SHORT: Record<Slot, string> = {
  MATIN: "Matin",
  DEBUT_APREM: "Déb. ap.-midi",
  FIN_APREM: "Fin ap.-midi",
};

export const RESULT_LABEL: Record<CallResult, string> = {
  HUMAN_ANSWERED: "Décroché",
  ANSWERED_NOT_TAKEN: "Non pris",
  VOICEMAIL: "Échec (répondeur)",
  NO_ANSWER: "Pas de réponse",
  INVALID_NUMBER: "Numéro invalide",
  FAILED: "Échec",
};

export interface SlotRate {
  slot: Slot;
  label: string;
  short: string;
  total: number;
  humanAnswers: number;
  ratePct: number; // 0–100
}

export interface CampaignKpi {
  id: string;
  name: string;
  status: string;
  total: number;
  active: number;
  excluded: number;
}

export interface QueueItem {
  prospectId: string;
  company: string | null;
  contactName: string | null;
  phoneNumber: string;
  scorePct: number | null;
  isCallback: boolean;
  isExploration: boolean;
}

export type QueuePreview =
  | { kind: "outside_window"; nextWindow: string }
  | { kind: "empty"; slot: Slot; slotLabel: string }
  | { kind: "ok"; slot: Slot; slotLabel: string; items: QueueItem[] };

// ── Slot answer rates (all time) ──────────────────────────────────────────

export async function getSlotRates(accountId: string): Promise<SlotRate[]> {
  const groups = await prisma.callAttempt.groupBy({
    by: ["slot", "result"],
    where: { accountId, result: { not: null } },
    _count: { _all: true },
  });

  return SLOTS.map((slot) => {
    const sg = groups.filter((g) => g.slot === slot);
    const total = sg.reduce((s, g) => s + g._count._all, 0);
    const humanAnswers = sg.find((g) => g.result === "HUMAN_ANSWERED")?._count._all ?? 0;
    return {
      slot,
      label: SLOT_LABEL[slot],
      short: SLOT_SHORT[slot],
      total,
      humanAnswers,
      ratePct: total === 0 ? 0 : Math.round((humanAnswers / total) * 100),
    };
  });
}

// ── Today's volume by slot ────────────────────────────────────────────────

export async function getTodayVolume(
  accountId: string,
  todayStart: Date
): Promise<{ total: number; bySlot: Record<Slot, number> }> {
  const groups = await prisma.callAttempt.groupBy({
    by: ["slot"],
    where: { accountId, startedAt: { gte: todayStart } },
    _count: { _all: true },
  });

  const bySlot: Record<Slot, number> = { MATIN: 0, DEBUT_APREM: 0, FIN_APREM: 0 };
  let total = 0;
  for (const g of groups) {
    bySlot[g.slot as Slot] = g._count._all;
    total += g._count._all;
  }
  return { total, bySlot };
}

// ── Campaign KPIs ─────────────────────────────────────────────────────────

export async function getCampaignKpis(accountId: string): Promise<CampaignKpi[]> {
  const campaigns = await prisma.campaign.findMany({
    where: { accountId },
    select: {
      id: true,
      name: true,
      status: true,
      prospectLists: {
        select: {
          prospectList: { select: { prospects: { select: { status: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return campaigns.map((c) => {
    const prospects = c.prospectLists.flatMap((pl) => pl.prospectList.prospects);
    const excluded = prospects.filter((p) => p.status === "EXCLUDED").length;
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      total: prospects.length,
      active: prospects.length - excluded,
      excluded,
    };
  });
}

// ── Pending callbacks count ───────────────────────────────────────────────

export async function getPendingCallbackCount(accountId: string, now: Date): Promise<number> {
  return prisma.callAttempt.count({
    where: {
      accountId,
      disposition: { behavior: "CALLBACK" },
      callbackAt: { lte: now },
      prospect: { status: "ACTIVE" },
    },
  });
}

// ── Queue preview (top N prospects across active campaigns) ───────────────

export async function getQueuePreview(
  accountId: string,
  now: Date,
  limit = 5
): Promise<QueuePreview> {
  if (!isWithinLegalWindow(now)) {
    return { kind: "outside_window", nextWindow: nextLegalWindow(now).toISOString() };
  }

  const slot = getCurrentSlot(now)!;
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - 30);

  const campaigns = await prisma.campaign.findMany({
    where: { accountId, status: "ACTIVE" },
    select: { prospectLists: { select: { prospectListId: true } } },
  });

  const listIds = campaigns.flatMap((c) => c.prospectLists.map((pl) => pl.prospectListId));
  if (listIds.length === 0) return { kind: "empty", slot, slotLabel: SLOT_LABEL[slot] };

  const prospects = await prisma.prospect.findMany({
    where: { accountId, listId: { in: listIds }, status: "ACTIVE" },
    select: {
      id: true,
      company: true,
      contactName: true,
      phoneNumber: true,
      slotStats: { where: { slot }, select: { attempts: true, humanAnswers: true } },
      callAttempts: {
        select: {
          result: true,
          callbackAt: true,
          startedAt: true,
          disposition: { select: { behavior: true } },
        },
        orderBy: { startedAt: "desc" },
      },
    },
    take: 300,
  });

  // Ceiling: ≤4 counted attempts (ANSWERED_NOT_TAKEN excluded) in rolling 30 days
  const eligible = prospects.filter((p) => {
    const counted = p.callAttempts.filter(
      (a) => a.startedAt >= windowStart && a.result !== "ANSWERED_NOT_TAKEN"
    ).length;
    return counted < 4;
  });

  if (eligible.length === 0) return { kind: "empty", slot, slotLabel: SLOT_LABEL[slot] };

  const slotScore = (p: (typeof eligible)[number]): number => {
    const stat = p.slotStats[0];
    return stat ? computeScore(stat.attempts, stat.humanAnswers) : 0;
  };

  // Priority buckets
  const callbacks = eligible.filter((p) => {
    const a = p.callAttempts[0];
    return a?.disposition?.behavior === "CALLBACK" && a.callbackAt != null && a.callbackAt <= now;
  });
  const cbIds = new Set(callbacks.map((p) => p.id));
  const rest = eligible.filter((p) => !cbIds.has(p.id));
  // Exploration = zero attempts ever
  const exploration = rest.filter((p) => p.callAttempts.length === 0);
  const exIds = new Set(exploration.map((p) => p.id));
  const scored = rest.filter((p) => !exIds.has(p.id)).sort((a, b) => slotScore(b) - slotScore(a));

  const ordered = [...callbacks, ...exploration, ...scored].slice(0, limit);

  return {
    kind: "ok",
    slot,
    slotLabel: SLOT_LABEL[slot],
    items: ordered.map((p) => {
      const s = slotScore(p);
      return {
        prospectId: p.id,
        company: p.company,
        contactName: p.contactName,
        phoneNumber: p.phoneNumber,
        scorePct: p.slotStats[0] ? Math.round(s * 100) : null,
        isCallback: cbIds.has(p.id),
        isExploration: exIds.has(p.id),
      };
    }),
  };
}

// ── Stats: day × slot answer rates ───────────────────────────────────────

const DAY_LABEL = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export interface DaySlotRow {
  day: string;
  dayIndex: number;
  MATIN: number;
  DEBUT_APREM: number;
  FIN_APREM: number;
}

export async function getDaySlotRates(accountId: string): Promise<DaySlotRow[]> {
  const attempts = await prisma.callAttempt.findMany({
    where: { accountId, result: { not: null } },
    select: { slot: true, result: true, startedAt: true },
  });

  // Group by (dayOfWeek, slot)
  type Key = `${number}_${Slot}`;
  const totals: Record<Key, number> = {} as Record<Key, number>;
  const humans: Record<Key, number> = {} as Record<Key, number>;

  for (const a of attempts) {
    const dow = new Date(a.startedAt).getDay();
    const key: Key = `${dow}_${a.slot as Slot}`;
    totals[key] = (totals[key] ?? 0) + 1;
    if (a.result === "HUMAN_ANSWERED") humans[key] = (humans[key] ?? 0) + 1;
  }

  // Mon–Fri only (legal days)
  const rows: DaySlotRow[] = [];
  for (let dow = 1; dow <= 5; dow++) {
    const rate = (slot: Slot): number => {
      const key: Key = `${dow}_${slot}`;
      const t = totals[key] ?? 0;
      return t === 0 ? 0 : Math.round(((humans[key] ?? 0) / t) * 100);
    };
    rows.push({
      day: DAY_LABEL[dow],
      dayIndex: dow,
      MATIN: rate("MATIN"),
      DEBUT_APREM: rate("DEBUT_APREM"),
      FIN_APREM: rate("FIN_APREM"),
    });
  }
  return rows;
}

// ── Stats: result distribution ────────────────────────────────────────────

export interface ResultCount {
  result: CallResult;
  label: string;
  count: number;
}

export async function getResultDistribution(accountId: string): Promise<ResultCount[]> {
  const groups = await prisma.callAttempt.groupBy({
    by: ["result"],
    where: { accountId, result: { not: null } },
    _count: { _all: true },
  });

  const ORDER: CallResult[] = [
    "HUMAN_ANSWERED",
    "ANSWERED_NOT_TAKEN",
    "VOICEMAIL",
    "NO_ANSWER",
    "FAILED",
  ];
  return ORDER.map((result) => ({
    result,
    label: RESULT_LABEL[result],
    count: groups.find((g) => g.result === result)?._count._all ?? 0,
  })).filter((r) => r.count > 0);
}

// ── Stats: average human call duration + totals ───────────────────────────

export interface CallSummary {
  totalAttempts: number;
  humanAnswers: number;
  avgDurationSec: number | null;
  bestSlot: Slot | null;
  bestSlotRatePct: number | null;
}

export async function getCallSummary(accountId: string): Promise<CallSummary> {
  const [totAgg, durAgg, slotAgg] = await Promise.all([
    prisma.callAttempt.count({ where: { accountId, result: { not: null } } }),
    prisma.callAttempt.aggregate({
      where: { accountId, result: "HUMAN_ANSWERED", durationSec: { not: null } },
      _avg: { durationSec: true },
      _count: { _all: true },
    }),
    prisma.prospectSlotStat.groupBy({
      by: ["slot"],
      where: { accountId },
      _sum: { attempts: true, humanAnswers: true },
    }),
  ]);

  let bestSlot: Slot | null = null;
  let bestRatePct: number | null = null;
  for (const g of slotAgg) {
    const t = g._sum.attempts ?? 0;
    const h = g._sum.humanAnswers ?? 0;
    if (t === 0) continue;
    const pct = Math.round((h / t) * 100);
    if (bestRatePct === null || pct > bestRatePct) {
      bestRatePct = pct;
      bestSlot = g.slot as Slot;
    }
  }

  return {
    totalAttempts: totAgg,
    humanAnswers: durAgg._count._all,
    avgDurationSec: durAgg._avg.durationSec != null ? Math.round(durAgg._avg.durationSec) : null,
    bestSlot,
    bestSlotRatePct: bestRatePct,
  };
}

// ── Stats: best slot by tag ───────────────────────────────────────────────

export interface TagSlotStat {
  tagId: string;
  tagName: string;
  tagColor: string;
  bestSlot: Slot | null;
  bestSlotLabel: string | null;
  bestRatePct: number | null;
  totalAttempts: number;
}

export async function getTagSlotStats(accountId: string): Promise<TagSlotStat[]> {
  const tags = await prisma.tag.findMany({
    where: { accountId },
    select: {
      id: true,
      name: true,
      color: true,
      prospects: {
        select: {
          prospect: {
            select: {
              slotStats: { select: { slot: true, attempts: true, humanAnswers: true } },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return tags.map((tag) => {
    const slotTotals: Partial<Record<Slot, { attempts: number; humanAnswers: number }>> = {};
    for (const { prospect } of tag.prospects) {
      for (const s of prospect.slotStats) {
        const slot = s.slot as Slot;
        const prev = slotTotals[slot] ?? { attempts: 0, humanAnswers: 0 };
        slotTotals[slot] = {
          attempts: prev.attempts + s.attempts,
          humanAnswers: prev.humanAnswers + s.humanAnswers,
        };
      }
    }

    const totalAttempts = Object.values(slotTotals).reduce((acc, s) => acc + s!.attempts, 0);
    let bestSlot: Slot | null = null;
    let bestRatePct: number | null = null;
    for (const [slot, s] of Object.entries(slotTotals) as [
      Slot,
      { attempts: number; humanAnswers: number },
    ][]) {
      if (s.attempts === 0) continue;
      const pct = Math.round((s.humanAnswers / s.attempts) * 100);
      if (bestRatePct === null || pct > bestRatePct) {
        bestRatePct = pct;
        bestSlot = slot;
      }
    }

    return {
      tagId: tag.id,
      tagName: tag.name,
      tagColor: tag.color,
      bestSlot,
      bestSlotLabel: bestSlot ? SLOT_LABEL[bestSlot] : null,
      bestRatePct,
      totalAttempts,
    };
  });
}
