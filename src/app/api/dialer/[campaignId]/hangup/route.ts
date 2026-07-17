import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getTwilioClientForAccount } from "@/lib/twilio";

export async function POST(req: Request, { params }: { params: Promise<{ campaignId: string }> }) {
  const ctx = await requireAccount();
  const { campaignId } = await params;
  const body = (await req.json()) as { callAttemptId: string };

  const attempt = await prisma.callAttempt.findUnique({
    where: { id: body.callAttemptId, accountId: ctx.accountId, campaignId },
    select: { id: true, twilioCallSid: true, result: true },
  });

  if (!attempt) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (attempt.result !== null) return NextResponse.json({ ok: true });

  // Cancel / end the live Twilio call
  if (attempt.twilioCallSid) {
    try {
      const tw = await getTwilioClientForAccount(ctx.accountId);
      await tw.client.calls(attempt.twilioCallSid).update({ status: "completed" });
    } catch {
      // Call may already be over — proceed to mark FAILED anyway
    }
  }

  await prisma.callAttempt.update({
    where: { id: attempt.id },
    data: { result: "FAILED" },
  });

  return NextResponse.json({ ok: true });
}
