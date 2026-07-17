import { parseTwilioWebhook, twimlResponse, forbidden } from "@/lib/webhooks";
import { prisma } from "@/lib/prisma";
import { updateProspectSlotStat } from "@/lib/scoring";
import { charge } from "@/lib/credits";
import { PLAN_CONFIG } from "@/lib/plan-config";
import type { CallResult, Slot } from "@/types";

/**
 * Fires when the <Dial> to the agent's browser Device completes.
 *
 * DialCallStatus=completed  → agent picked up and conversation ended  → HUMAN_ANSWERED
 * DialCallStatus=no-answer  → agent didn't pick up within timeout (15 s) → ANSWERED_NOT_TAKEN
 * DialCallStatus=busy|failed → agent device error                       → ANSWERED_NOT_TAKEN
 */
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("aid");
  const callAttemptId = searchParams.get("cid");

  if (!accountId || !callAttemptId) return forbidden();

  const { ok, body } = await parseTwilioWebhook(request, accountId);
  if (!ok) return forbidden();

  const dialStatus = body.get("DialCallStatus") ?? "";
  const dialDuration = parseInt(body.get("DialCallDuration") ?? "0") || null;

  const attempt = await prisma.callAttempt.findUnique({
    where: { id: callAttemptId, accountId },
    select: {
      prospectId: true,
      slot: true,
      result: true,
      accountId: true,
      account: { select: { plan: true } },
    },
  });
  if (!attempt || attempt.result !== null) {
    // Already resolved — hang up cleanly
    return twimlResponse('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>');
  }

  const result: CallResult = dialStatus === "completed" ? "HUMAN_ANSWERED" : "ANSWERED_NOT_TAKEN";

  await prisma.callAttempt.update({
    where: { id: callAttemptId },
    data: {
      result,
      ...(dialDuration !== null ? { durationSec: dialDuration } : {}),
    },
  });

  // ANSWERED_NOT_TAKEN is a no-op in updateProspectSlotStat (per lot 5 design)
  await updateProspectSlotStat(attempt.accountId, attempt.prospectId, attempt.slot as Slot, result);

  // Surcharge for human answer — varies by plan
  if (result === "HUMAN_ANSWERED") {
    const surcharge = PLAN_CONFIG[attempt.account.plan].humanAnsweredSurcharge;
    await charge(attempt.accountId, surcharge, "HUMAN_ANSWERED_SURCHARGE", callAttemptId).catch(
      () => null // best-effort; balance may have just hit 0 in edge cases
    );
  }

  // Hang up the prospect's leg after the dial completes
  return twimlResponse('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>');
}
