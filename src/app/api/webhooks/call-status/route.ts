import { NextResponse } from "next/server";
import { parseTwilioWebhook, forbidden } from "@/lib/webhooks";
import { prisma } from "@/lib/prisma";
import { updateProspectSlotStat } from "@/lib/scoring";
import type { CallResult, Slot } from "@/types";

/**
 * Fallback webhook for call lifecycle events (no-answer, busy, failed, completed).
 *
 * For calls where amd-result and dial-action already set the result, this webhook
 * only fills in durationSec if missing. For calls that never connected (no-answer,
 * busy, failed), this is the sole result writer.
 *
 * Responsibility split:
 *  - amd-result  → sets VOICEMAIL for confirmed machines
 *  - dial-action → sets HUMAN_ANSWERED or ANSWERED_NOT_TAKEN
 *  - call-status → sets NO_ANSWER / INVALID_NUMBER / FAILED for calls that never reached AMD/dial
 *
 * Bad number detection (SIP / Twilio error codes):
 *  - SipResponseCode 404 / 410 → number doesn't exist or was disconnected
 *  - ErrorCode 21211 → invalid 'To' phone number (malformed)
 *  - ErrorCode 21214 → 'To' phone number cannot be reached (carrier rejects routing)
 *  - ErrorCode 13226 → Twilio: invalid phone number
 */

// SIP response codes that reliably indicate the number is invalid / disconnected
const INVALID_SIP_CODES = new Set(["404", "410"]);

// Twilio error codes that indicate the number itself is bad
const INVALID_TWILIO_CODES = new Set(["21211", "21214", "13226"]);

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("aid");
  const callAttemptId = searchParams.get("cid");

  if (!accountId || !callAttemptId) return forbidden();

  const { ok, body } = await parseTwilioWebhook(request, accountId);
  if (!ok) return forbidden();

  const callStatus = body.get("CallStatus") ?? "";
  const callDuration = parseInt(body.get("CallDuration") ?? "0") || null;
  const sipResponseCode = body.get("SipResponseCode") ?? "";
  const errorCode = body.get("ErrorCode") ?? "";

  console.log(`[call-status] status=${callStatus} sip=${sipResponseCode} err=${errorCode} cid=${callAttemptId}`);

  const attempt = await prisma.callAttempt.findUnique({
    where: { id: callAttemptId, accountId },
    select: {
      prospectId: true,
      slot: true,
      result: true,
      durationSec: true,
      accountId: true,
    },
  });
  if (!attempt) return NextResponse.json({ ok: true });

  // Determine result only if not already set by amd-result or dial-action
  let resultToSet: CallResult | null = null;
  if (attempt.result === null) {
    const isBadNumber =
      INVALID_SIP_CODES.has(sipResponseCode) || INVALID_TWILIO_CODES.has(errorCode);

    if (isBadNumber) {
      resultToSet = "INVALID_NUMBER";
    } else if (callStatus === "no-answer" || callStatus === "busy") {
      resultToSet = "NO_ANSWER";
    } else if (callStatus === "failed" || callStatus === "canceled") {
      resultToSet = "FAILED";
    } else if (callStatus === "completed") {
      resultToSet = "FAILED"; // completed with no prior result is unexpected
    }
  }

  const updates: Record<string, unknown> = {};
  if (resultToSet) updates.result = resultToSet;
  if (callDuration !== null && attempt.durationSec === null) updates.durationSec = callDuration;

  if (Object.keys(updates).length > 0) {
    await prisma.callAttempt.update({ where: { id: callAttemptId }, data: updates });
  }

  // Update scoring only when this webhook is the one setting the result
  if (resultToSet) {
    await updateProspectSlotStat(
      attempt.accountId,
      attempt.prospectId,
      attempt.slot as Slot,
      resultToSet
    );
  }

  // Permanently blacklist the prospect when the number is confirmed invalid
  if (resultToSet === "INVALID_NUMBER") {
    await prisma.prospect.update({
      where: { id: attempt.prospectId },
      data: { status: "EXCLUDED", excludedAt: new Date() },
    });
    console.log(`[call-status] prospect ${attempt.prospectId} EXCLUDED — invalid number`);
  }

  return NextResponse.json({ ok: true });
}
