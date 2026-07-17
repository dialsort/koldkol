import { NextResponse } from "next/server";
import { parseTwilioWebhook, twimlResponse, forbidden } from "@/lib/webhooks";
import { prisma } from "@/lib/prisma";
import { getTwilioClientForAccount, buildBridgeTwiml, HANGUP_TWIML } from "@/lib/twilio";
import { updateProspectSlotStat } from "@/lib/scoring";
import type { CallResult, Slot } from "@/types";

/**
 * Stratégie AMD :
 *
 * - machine_start     → répondeur en train de parler → raccrocher immédiatement
 * - machine_end_*     → répondeur terminé (bip, silence, autre) → raccrocher
 * - fax               → raccrocher
 * - unknown           → incertain → on bascule vers l'agent (biais humain)
 *
 * On bascule machine_start côté "machine" car la valeur signifie littéralement
 * "une machine a commencé à parler". Le seul risque (humain lent classé machine)
 * est couvert par unknown → agent.
 */
const CONFIRMED_MACHINE = new Set([
  "machine_start",
  "machine_end_beep",
  "machine_end_silence",
  "machine_end_other",
  "fax",
]);

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("aid");
  const callAttemptId = searchParams.get("cid");
  const agentId = searchParams.get("uid");

  if (!accountId || !callAttemptId || !agentId) return forbidden();

  const { ok, body } = await parseTwilioWebhook(request, accountId);
  if (!ok) return forbidden();

  const callSid = body.get("CallSid") ?? "";
  const answeredBy = body.get("AnsweredBy") ?? "unknown";

  console.log(`[amd-result] callSid=${callSid} answeredBy=${answeredBy} attemptId=${callAttemptId}`);

  // Look up the attempt to get prospect/slot context (accountId filter = defence in depth)
  const attempt = await prisma.callAttempt.findUnique({
    where: { id: callAttemptId, accountId },
    select: { id: true, prospectId: true, slot: true, result: true },
  });
  if (!attempt || attempt.result !== null) {
    // Already resolved (duplicate webhook) — acknowledge silently
    return NextResponse.json({ ok: true });
  }

  const isConfirmedMachine = CONFIRMED_MACHINE.has(answeredBy);

  if (isConfirmedMachine) {
    // Hang up prospect + record VOICEMAIL
    try {
      const tw = await getTwilioClientForAccount(accountId);
      await tw.client.calls(callSid).update({ twiml: HANGUP_TWIML });
    } catch {
      // Best-effort hangup; status webhook will handle cleanup if this fails
    }

    await prisma.callAttempt.update({
      where: { id: callAttemptId },
      data: { result: "VOICEMAIL" },
    });
    await updateProspectSlotStat(accountId, attempt.prospectId, attempt.slot as Slot, "VOICEMAIL");

    return NextResponse.json({ ok: true, action: "hangup", answeredBy });
  }

  // Human (or ambiguous) → bridge to agent browser via <Dial><Client>
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const dialActionUrl =
    `${base}/api/webhooks/dial-action` +
    `?aid=${encodeURIComponent(accountId)}&cid=${encodeURIComponent(callAttemptId)}`;

  const bridgeTwiml = buildBridgeTwiml(agentId, dialActionUrl);

  try {
    const tw = await getTwilioClientForAccount(accountId);
    await tw.client.calls(callSid).update({ twiml: bridgeTwiml });
    console.log(`[amd-result] bridge sent → agent=${agentId} call=${callSid}`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "bridge_failed";
    console.error(`[amd-result] bridge failed for ${callSid}:`, errMsg);
    const result: CallResult = "FAILED";
    await prisma.callAttempt.update({ where: { id: callAttemptId }, data: { result } });
    await updateProspectSlotStat(accountId, attempt.prospectId, attempt.slot as Slot, result);
    return NextResponse.json({ ok: false, error: errMsg }, { status: 500 });
  }

  return twimlResponse('<?xml version="1.0" encoding="UTF-8"?><Response/>');
}
