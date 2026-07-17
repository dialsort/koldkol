import { prisma } from "@/lib/prisma";
import type { CallResult, Slot } from "@/types";

/** Score for a (prospect, slot) pair. Returns 0 when no attempts have been recorded. */
export function computeScore(attempts: number, humanAnswers: number): number {
  return attempts === 0 ? 0 : humanAnswers / attempts;
}

/**
 * Upserts ProspectSlotStat after a completed call attempt.
 *
 * ANSWERED_NOT_TAKEN increments neither `attempts` nor `humanAnswers`.
 * Rationale: the prospect picked up but the agent was unavailable — this is an
 * operational failure on our side, not evidence about when the prospect is
 * reachable. Counting it would unfairly depress the slot score.
 */
export async function updateProspectSlotStat(
  accountId: string,
  prospectId: string,
  slot: Slot,
  result: CallResult
): Promise<void> {
  if (result === "ANSWERED_NOT_TAKEN") return;

  const humanAnswersInc = result === "HUMAN_ANSWERED" ? 1 : 0;

  await prisma.prospectSlotStat.upsert({
    where: { prospectId_slot: { prospectId, slot } },
    create: { prospectId, slot, accountId, attempts: 1, humanAnswers: humanAnswersInc },
    update: { attempts: { increment: 1 }, humanAnswers: { increment: humanAnswersInc } },
  });
}
