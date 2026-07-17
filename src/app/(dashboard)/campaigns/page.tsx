// @ts-nocheck — pending rewrite (schema migration lot 2)
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import type { CampaignStatus, ContactStatus } from "@/types";

const STATUS_COLORS: Record<CampaignStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  RUNNING: "bg-blue-100 text-blue-700",
  PAUSED: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-green-100 text-green-700",
};

const STATUS_LABELS: Record<CampaignStatus, string> = {
  DRAFT: "Brouillon",
  RUNNING: "En cours",
  PAUSED: "Pausée",
  COMPLETED: "Terminée",
};

export default async function CampaignsPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id ?? "";

  const campaigns = await prisma.campaign.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { contacts: true } } },
  });

  const enriched = await Promise.all(
    campaigns.map(async (c) => {
      const stats = await prisma.contact.groupBy({
        by: ["status"],
        where: { campaignId: c.id },
        _count: true,
      });
      const byStatus = Object.fromEntries(stats.map((s) => [s.status, s._count])) as Partial<
        Record<ContactStatus, number>
      >;
      return { ...c, byStatus };
    })
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Campagnes</h1>
        <Link
          href="/campaigns/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Nouvelle campagne
        </Link>
      </div>

      {enriched.length === 0 ? (
        <div className="rounded-xl bg-white border border-gray-200 p-12 text-center text-gray-400">
          <p className="text-lg mb-2">Aucune campagne</p>
          <p className="text-sm mb-4">Importez votre premier fichier CSV pour commencer.</p>
          <Link
            href="/campaigns/new"
            className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Créer une campagne
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {enriched.map((c) => {
            const total = c._count.contacts;
            const reachable = c.byStatus.REACHABLE ?? 0;
            const pct = total ? Math.round((reachable / total) * 100) : 0;

            return (
              <div
                key={c.id}
                className="rounded-xl bg-white border border-gray-200 p-5 flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="font-semibold text-gray-900 hover:text-blue-600 truncate"
                    >
                      {c.name}
                    </Link>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status as CampaignStatus]}`}
                    >
                      {STATUS_LABELS[c.status as CampaignStatus]}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {total} contacts · {reachable} joignables ({pct}%)
                  </div>
                  {total > 0 && (
                    <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-2 shrink-0">
                  <Link
                    href={`/campaigns/${c.id}`}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Voir
                  </Link>
                  <Link
                    href={`/api/campaigns/${c.id}/export`}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Export CSV
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
