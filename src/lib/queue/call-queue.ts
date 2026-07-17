// @ts-nocheck — pending rewrite (schema migration lot 2)
import Bull from "bull";

export type CallJob = {
  contactId: string;
  campaignId: string;
  userId: string;
  phone: string;
  attemptNumber: number;
};

let callQueue: Bull.Queue<CallJob> | null = null;

export function getCallQueue(): Bull.Queue<CallJob> {
  if (!callQueue) {
    callQueue = new Bull<CallJob>("call-queue", {
      redis: process.env.REDIS_URL || "redis://localhost:6379",
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    });
  }
  return callQueue;
}

export async function enqueueCall(job: CallJob, delayMs = 0): Promise<Bull.Job<CallJob>> {
  const queue = getCallQueue();
  return queue.add(job, { delay: delayMs });
}

export async function enqueueCallBatch(jobs: CallJob[], rateLimitMs = 6000): Promise<void> {
  const queue = getCallQueue();
  const bulkJobs = jobs.map((job, i) => ({
    data: job,
    opts: { delay: i * rateLimitMs },
  }));
  await queue.addBulk(bulkJobs);
}
