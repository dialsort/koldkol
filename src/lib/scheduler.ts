// @ts-nocheck — pending rewrite (schema migration lot 2)
import { enqueueCallBatch, type CallJob } from "@/lib/queue/call-queue";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SLOTS, MAX_ATTEMPTS } from "@/lib/constants";

export { DEFAULT_SLOTS, MAX_ATTEMPTS };

export async function scheduleCampaignWave(campaignId: string, userId: string, _slotHour: number) {
  const contacts = await prisma.contact.findMany({
    where: {
      campaignId,
      status: { in: ["PENDING", "CALLING"] },
      attemptCount: { lt: MAX_ATTEMPTS },
      bloctelBlocked: false,
    },
    select: { id: true, phone: true, attemptCount: true },
  });

  if (contacts.length === 0) return 0;

  const jobs: CallJob[] = contacts.map((c) => ({
    contactId: c.id,
    campaignId,
    userId,
    phone: c.phone,
    attemptNumber: c.attemptCount + 1,
  }));

  // 10 calls/min = 6000ms gap between each call
  await enqueueCallBatch(
    jobs.map((j) => j),
    6000
  );

  return contacts.length;
}

export async function scheduleAllWaves(
  campaignId: string,
  userId: string,
  slots: number[] = DEFAULT_SLOTS
) {
  for (const slot of slots) {
    await scheduleCampaignWave(campaignId, userId, slot);
  }
}
