import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getTwilioClientForAccount, placeDialerCall } from "@/lib/twilio";
import { getNextProspect } from "@/lib/queue";
import { getCurrentSlot, isWithinLegalWindow, nextLegalWindow } from "@/lib/slots";
import type { Slot } from "@/types";

/**
 * POST /api/dialer/[campaignId]/call
 *
 * Selects the next prospect (or uses the explicitly provided prospectId), places
 * one outbound call with async AMD, and returns tracking info to the client.
 *
 * Idempotence guarantee: campaign status re-check, in-progress guard, credit
 * debit, and CallAttempt creation are wrapped in a single Prisma interactive
 * transaction — preventing double-call races under concurrent requests.
 */
export async function POST(req: Request, { params }: { params: Promise<{ campaignId: string }> }) {
  const ctx = await requireAccount();
  const { campaignId } = await params;
  const now = new Date();

  // Optional explicit prospect override
  const body = await req.json().catch(() => ({})) as { prospectId?: string };

  // Verify campaign belongs to this account (fast pre-flight — re-checked inside tx)
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { accountId: true, status: true, prospectLists: { select: { prospectListId: true } } },
  });
  if (!campaign || campaign.accountId !== ctx.accountId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (campaign.status !== "ACTIVE") {
    return NextResponse.json({ error: "CAMPAIGN_NOT_ACTIVE" }, { status: 409 });
  }

  // Legal window check (cheap, before any DB writes)
  if (!isWithinLegalWindow(now)) {
    return NextResponse.json({
      kind: "outside_window",
      nextWindow: nextLegalWindow(now).toISOString(),
    });
  }

  let prospectId: string;
  let phoneNumber: string;
  let slot: Slot;
  let waveNumber: number | null = null;

  if (body.prospectId) {
    // Manual selection — verify prospect belongs to this account and campaign's lists
    const listIds = campaign.prospectLists.map((pl) => pl.prospectListId);
    const prospect = await prisma.prospect.findUnique({
      where: { id: body.prospectId, accountId: ctx.accountId },
      select: { id: true, phoneNumber: true, status: true, listId: true },
    });
    if (!prospect || prospect.status !== "ACTIVE" || !listIds.includes(prospect.listId)) {
      return NextResponse.json({ error: "PROSPECT_NOT_ELIGIBLE" }, { status: 422 });
    }
    prospectId = prospect.id;
    phoneNumber = prospect.phoneNumber;
    slot = getCurrentSlot(now) ?? "MATIN";
  } else {
    // Auto-select via queue
    const queue = await getNextProspect(campaignId, now);
    if (queue.kind === "outside_window") {
      return NextResponse.json({
        kind: "outside_window",
        nextWindow: queue.nextWindow.toISOString(),
      });
    }
    ({ prospectId, phoneNumber, slot, waveNumber } = queue.prospect);
  }

  // Fetch Twilio client before the transaction (network I/O must not hold a tx open)
  let tw: Awaited<ReturnType<typeof getTwilioClientForAccount>>;
  try {
    tw = await getTwilioClientForAccount(ctx.accountId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    return NextResponse.json({ error: "TWILIO_UNAVAILABLE", detail: msg }, { status: 503 });
  }

  // Auto-expire stuck calls older than 5 minutes (webhook never arrived)
  await prisma.callAttempt.updateMany({
    where: {
      campaignId,
      accountId: ctx.accountId,
      result: null,
      startedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) },
    },
    data: { result: "FAILED" },
  });

  // ── Atomic guard: re-check campaign + in-progress + credit + create attempt ──
  //
  // All four steps are in one interactive transaction so a concurrent request
  // cannot slip through between the in-progress check and the attempt INSERT.
  let attempt: { id: string };
  try {
    attempt = await prisma.$transaction(async (tx) => {
      // Re-verify campaign is still ACTIVE (could have been paused since pre-flight)
      const cam = await tx.campaign.findUnique({
        where: { id: campaignId },
        select: { status: true, accountId: true },
      });
      if (cam?.accountId !== ctx.accountId || cam.status !== "ACTIVE") {
        throw new Error("CAMPAIGN_NOT_ACTIVE");
      }

      // Re-verify no call is already in flight for this campaign
      const inFlight = await tx.callAttempt.findFirst({
        where: { campaignId, accountId: ctx.accountId, result: null },
        select: { id: true },
      });
      if (inFlight) throw new Error(`CALL_IN_PROGRESS:${inFlight.id}`);

      // Check credit balance
      const balanceAgg = await tx.creditLedger.aggregate({
        where: { accountId: ctx.accountId },
        _sum: { delta: true },
      });
      if ((balanceAgg._sum.delta ?? 0) < 1) throw new Error("INSUFFICIENT_CREDITS");

      // Create the attempt row (its id is needed by webhook URLs)
      const created = await tx.callAttempt.create({
        data: { accountId: ctx.accountId, prospectId, campaignId, slot: slot as Slot },
      });

      // Deduct 1 credit atomically with attempt creation — non-refundable on failure
      await tx.creditLedger.create({
        data: {
          accountId: ctx.accountId,
          delta: -1,
          reason: "CALL_ATTEMPT",
          relatedCallAttemptId: created.id,
        },
      });
      await tx.callAttempt.update({
        where: { id: created.id },
        data: { creditsCharged: { increment: 1 } },
      });

      return created;
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "CAMPAIGN_NOT_ACTIVE") {
      return NextResponse.json({ error: "CAMPAIGN_NOT_ACTIVE" }, { status: 409 });
    }
    if (msg.startsWith("CALL_IN_PROGRESS")) {
      return NextResponse.json(
        { error: "CALL_IN_PROGRESS", callAttemptId: msg.split(":")[1] },
        { status: 409 }
      );
    }
    if (msg === "INSUFFICIENT_CREDITS") {
      return NextResponse.json({ error: "INSUFFICIENT_CREDITS" }, { status: 402 });
    }
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }

  // ── Place the Twilio call ─────────────────────────────────────────────────
  try {
    const call = await placeDialerCall({
      to: phoneNumber,
      from: tw.phone!,
      client: tw.client,
      callAttemptId: attempt.id,
      accountId: ctx.accountId,
      agentId: ctx.userId,
    });

    await prisma.callAttempt.update({
      where: { id: attempt.id },
      data: { twilioCallSid: call.sid },
    });

    return NextResponse.json({
      kind: "dialing",
      callAttemptId: attempt.id,
      prospectId,
      slot,
      waveNumber,
      twilioCallSid: call.sid,
    });
  } catch (err) {
    await prisma.callAttempt.update({
      where: { id: attempt.id },
      data: { result: "FAILED" },
    });

    const twilioErr = err as Error & { code?: number; status?: number; moreInfo?: string };
    const msg = twilioErr.message ?? String(err);
    console.error("[dialer] Twilio call failed:", { code: twilioErr.code, status: twilioErr.status, msg, moreInfo: twilioErr.moreInfo });
    if (msg.includes("20003") || msg.includes("20103") || msg.includes("Authenticate")) {
      await prisma.twilioConnection.update({
        where: { accountId: ctx.accountId },
        data: { status: "INVALID_KEY" },
      });
      return NextResponse.json({ error: "INVALID_KEY" }, { status: 503 });
    }
    if (msg.includes("429") || msg.includes("quota")) {
      await prisma.twilioConnection.update({
        where: { accountId: ctx.accountId },
        data: { status: "QUOTA_EXCEEDED" },
      });
      return NextResponse.json({ error: "QUOTA_EXCEEDED" }, { status: 503 });
    }
    return NextResponse.json({ error: "CALL_FAILED", detail: msg }, { status: 502 });
  }
}
