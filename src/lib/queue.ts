import { prisma } from "@/lib/prisma";
import { getCurrentSlot, isWithinLegalWindow, nextLegalWindow } from "@/lib/slots";
import { computeScore } from "@/lib/scoring";
import type { Slot } from "@/types";

// ─── Wave logic constants ─────────────────────────────────────────────────────
//
// Each campaign runs in up to 3 waves. Each wave uses a DIFFERENT legal slot.
// A prospect is "done" in a campaign when:
//   - They answered (HUMAN_ANSWERED / ANSWERED_NOT_TAKEN) → success, no retry
//   - They had an invalid number (INVALID_NUMBER) → permanently blacklisted
//   - They have 3 completed attempts in 3 different slots → final failure
//
// VOICEMAIL and NO_ANSWER are retriable: the system recalls in a different slot.

const TERMINAL_RESULTS = new Set(["HUMAN_ANSWERED", "ANSWERED_NOT_TAKEN", "INVALID_NUMBER"]);

// Per-campaign max wave count — matches the 3 legal slots (MATIN, DEBUT_APREM, FIN_APREM).
export const MAX_WAVES = 3;

export interface AttemptCeilingOptions {
  /** Hard cap on attempts per prospect in this campaign. Default: MAX_WAVES (3). */
  maxAttempts?: number;
}

export interface QueuedProspect {
  prospectId: string;
  phoneNumber: string;
  campaignId: string;
  slot: Slot;
  /** humanAnswers / attempts for the current slot. 0 for exploration prospects. */
  score: number;
  /** True when the prospect has never been called in any slot across all campaigns. */
  isExploration: boolean;
  /** True when an overdue CALLBACK disposition triggered this pick. */
  isCallback: boolean;
  /** Wave number (1, 2 or 3) based on completed attempts in this campaign. */
  waveNumber: number;
}

export type QueueResult =
  | { kind: "prospect"; prospect: QueuedProspect }
  | {
      kind: "outside_window";
      nextWindow: Date;
      /**
       * "legal_hours" — current time is outside legal calling hours.
       * "no_prospects" — no eligible prospects remain for this campaign.
       * "wave_done"    — this slot's wave is done; come back in a different slot.
       */
      reason: "legal_hours" | "no_prospects" | "wave_done";
    };

/**
 * Returns the next prospect to call for a campaign using the 3-wave strategy.
 *
 * Priority order:
 *  1. Overdue callbacks (bypass wave filter).
 *  2. Wave 1 — never called in this campaign (exploration-first, then score).
 *  3. Wave 2 — 1 prior attempt, current slot not yet used.
 *  4. Wave 3 — 2 prior attempts, current slot not yet used.
 *
 * A prospect is ineligible for the current slot when:
 *  - A terminal result exists (HUMAN_ANSWERED, ANSWERED_NOT_TAKEN, INVALID_NUMBER).
 *  - They have MAX_WAVES completed attempts in this campaign.
 *  - They were already called in the current slot within this campaign.
 */
export async function getNextProspect(
  campaignId: string,
  now: Date,
  opts: AttemptCeilingOptions = {}
): Promise<QueueResult> {
  if (!isWithinLegalWindow(now)) {
    return { kind: "outside_window", nextWindow: nextLegalWindow(now), reason: "legal_hours" };
  }

  const slot = getCurrentSlot(now)!;
  const maxAttempts = opts.maxAttempts ?? MAX_WAVES;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      accountId: true,
      prospectLists: { select: { prospectListId: true } },
    },
  });
  if (!campaign) {
    return { kind: "outside_window", nextWindow: nextLegalWindow(now), reason: "no_prospects" };
  }

  const listIds = campaign.prospectLists.map((pl) => pl.prospectListId);
  if (listIds.length === 0) {
    return { kind: "outside_window", nextWindow: nextLegalWindow(now), reason: "no_prospects" };
  }

  const prospects = await prisma.prospect.findMany({
    where: {
      accountId: campaign.accountId,
      listId: { in: listIds },
      status: "ACTIVE",
    },
    select: {
      id: true,
      phoneNumber: true,
      slotStats: { select: { slot: true, attempts: true, humanAnswers: true } },
      callAttempts: {
        where: { campaignId },
        select: {
          startedAt: true,
          result: true,
          slot: true,
          callbackAt: true,
          disposition: { select: { behavior: true } },
        },
        orderBy: { startedAt: "desc" },
      },
    },
  });

  type Candidate = (typeof prospects)[number];

  const slotScore = (p: Candidate): number => {
    const stat = p.slotStats.find((s) => s.slot === slot);
    return stat ? computeScore(stat.attempts, stat.humanAnswers) : 0;
  };

  const totalGlobalAttempts = (p: Candidate): number =>
    p.slotStats.reduce((acc, s) => acc + s.attempts, 0);

  /** Wave info for a prospect in the current slot. */
  const waveInfo = (p: Candidate): { eligible: boolean; wave: number } => {
    const completed = p.callAttempts.filter((a) => a.result != null);

    if (completed.some((a) => TERMINAL_RESULTS.has(a.result!))) {
      return { eligible: false, wave: 0 };
    }
    if (completed.length >= maxAttempts) {
      return { eligible: false, wave: maxAttempts + 1 };
    }
    if (completed.some((a) => a.slot === slot)) {
      return { eligible: false, wave: completed.length + 1 };
    }
    return { eligible: true, wave: completed.length + 1 };
  };

  const toQueued = (p: Candidate, isCallback: boolean): QueuedProspect => ({
    prospectId: p.id,
    phoneNumber: p.phoneNumber,
    campaignId,
    slot,
    score: slotScore(p),
    isExploration: totalGlobalAttempts(p) === 0,
    isCallback,
    waveNumber: waveInfo(p).wave,
  });

  const isOverdueCallback = (p: Candidate): boolean => {
    const latest = p.callAttempts[0];
    return (
      latest?.disposition?.behavior === "CALLBACK" &&
      latest.callbackAt != null &&
      latest.callbackAt <= now
    );
  };

  // ── 1. Overdue callbacks (bypass wave filter) ───────────────────────────────
  const overdueCallbacks = prospects.filter(isOverdueCallback);
  if (overdueCallbacks.length > 0) {
    const sorted = [...overdueCallbacks].sort(
      (a, b) =>
        (a.callAttempts[0]?.callbackAt?.getTime() ?? 0) -
        (b.callAttempts[0]?.callbackAt?.getTime() ?? 0)
    );
    return { kind: "prospect", prospect: toQueued(sorted[0], true) };
  }

  // ── 2–4. Wave-eligible prospects ────────────────────────────────────────────
  const eligible = prospects
    .filter((p) => !isOverdueCallback(p) && waveInfo(p).eligible)
    .sort((a, b) => {
      const wa = waveInfo(a).wave;
      const wb = waveInfo(b).wave;
      if (wa !== wb) return wa - wb;

      // Within same wave: exploration first, then score descending
      const aExp = totalGlobalAttempts(a) === 0;
      const bExp = totalGlobalAttempts(b) === 0;
      if (aExp !== bExp) return aExp ? -1 : 1;

      return slotScore(b) - slotScore(a);
    });

  if (eligible.length === 0) {
    // Distinguish "needs a different slot" from "all done"
    const waitingForDifferentSlot = prospects.some((p) => {
      if (isOverdueCallback(p)) return false;
      const completed = p.callAttempts.filter((a) => a.result != null);
      return (
        !completed.some((a) => TERMINAL_RESULTS.has(a.result!)) &&
        completed.length < maxAttempts &&
        completed.some((a) => a.slot != null) // has at least one attempt, just not in current slot
      );
    });

    const reason = waitingForDifferentSlot ? "wave_done" : "no_prospects";
    return { kind: "outside_window", nextWindow: nextLegalWindow(now), reason };
  }

  return { kind: "prospect", prospect: toQueued(eligible[0], false) };
}
