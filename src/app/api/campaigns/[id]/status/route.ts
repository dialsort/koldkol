import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/session";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/campaigns/[id]/status
 * Body: { status: "ACTIVE" | "PAUSED" }
 *
 * Pause/resume a campaign without touching prospect data or call history.
 * The dialer route re-checks campaign status inside a transaction so a
 * pause taking effect between the pre-flight check and the attempt INSERT
 * is handled correctly (the transaction throws CAMPAIGN_NOT_ACTIVE).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAccount();
  const { id: campaignId } = await params;

  let status: unknown;
  try {
    ({ status } = (await request.json()) as { status: unknown });
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  if (status !== "ACTIVE" && status !== "PAUSED" && status !== "COMPLETED") {
    return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { accountId: true, status: true },
  });
  if (!campaign || campaign.accountId !== ctx.accountId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (campaign.status === "COMPLETED") {
    return NextResponse.json({ error: "CANNOT_MODIFY_COMPLETED" }, { status: 409 });
  }

  const updated = await prisma.campaign.update({
    where: { id: campaignId },
    data: { status },
    select: { id: true, name: true, status: true },
  });

  return NextResponse.json(updated);
}
