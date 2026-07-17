// @ts-nocheck — pending rewrite (schema migration lot 2)
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ResponseHeatmap } from "@/components/analytics/response-heatmap";
import type { CallAttempt } from "@/types";

export default async function AnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

  const userId = session?.user?.id;
  if (!userId) notFound();

  const campaign = await prisma.campaign.findFirst({
    where: { id, userId },
  });

  if (!campaign) notFound();

  const attempts = await prisma.callAttempt.findMany({
    where: { contact: { campaignId: id } },
    orderBy: { calledAt: "asc" },
  });

  const byAttempt = Array.from({ length: 5 }, (_, i) => {
    const forAttempt = attempts.filter((a) => a.attemptNumber === i + 1);
    const answered = forAttempt.filter((a) => a.status === "ANSWERED").length;
    return {
      attempt: i + 1,
      total: forAttempt.length,
      answered,
      rate: forAttempt.length ? Math.round((answered / forAttempt.length) * 100) : 0,
    };
  });

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <Link href={`/campaigns/${id}`} className="text-sm text-gray-400 hover:text-gray-600">
          ← {campaign.name}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Analytics</h1>
      </div>

      {/* Heatmap */}
      <div className="rounded-xl bg-white border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Taux de réponse par heure et jour</h2>
        {attempts.length === 0 ? (
          <p className="text-gray-400 text-sm">Aucun appel effectué encore.</p>
        ) : (
          <ResponseHeatmap attempts={attempts as unknown as CallAttempt[]} />
        )}
      </div>

      {/* Funnel par tentative */}
      <div className="rounded-xl bg-white border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Taux de réponse par tentative</h2>
        <div className="space-y-3">
          {byAttempt
            .filter((a) => a.total > 0)
            .map((a) => (
              <div key={a.attempt}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Tentative {a.attempt}</span>
                  <span className="font-medium">
                    {a.answered}/{a.total} réponses ({a.rate}%)
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${a.rate}%` }}
                  />
                </div>
              </div>
            ))}
          {byAttempt.every((a) => a.total === 0) && (
            <p className="text-gray-400 text-sm">Aucune donnée disponible.</p>
          )}
        </div>
      </div>
    </div>
  );
}
