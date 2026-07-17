// @ts-nocheck — pending rewrite (schema migration lot 2)
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import type { CampaignStatus, ContactStatus } from "@/types";

async function getStats(userId: string) {
  const [campaigns, totals, user] = await Promise.all([
    prisma.campaign.findMany({
      where: { userId },
      include: { _count: { select: { contacts: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.contact.groupBy({
      by: ["status"],
      where: { campaign: { userId } },
      _count: true,
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { twilioSid: true },
    }),
  ]);

  return { campaigns, totals, twilioConfigured: !!user?.twilioSid };
}

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

export default async function DashboardPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id ?? "";
  const { campaigns, totals, twilioConfigured } = await getStats(userId);

  const byStatus = Object.fromEntries(totals.map((t) => [t.status, t._count])) as Record<
    ContactStatus,
    number
  >;

  const total = totals.reduce((s, t) => s + t._count, 0);
  const reachable = byStatus.REACHABLE ?? 0;
  const unreachable = byStatus.UNREACHABLE ?? 0;
  const running = campaigns.filter((c) => c.status === "RUNNING").length;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Vue globale de vos campagnes</p>
        </div>
        <Link
          href="/campaigns/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Nouvelle campagne
        </Link>
      </div>

      {/* Onboarding banner */}
      {!twilioConfigured && (
        <div className="flex items-start gap-4 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex-shrink-0 text-2xl">📞</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-900">
              Configurez votre compte Twilio pour commencer à appeler
            </p>
            <p className="mt-1 text-sm text-amber-700">
              KoldKol a besoin de vos identifiants Twilio pour passer des appels. Suivez notre
              guide pas à pas pour créer et connecter votre compte en moins de 10 minutes.
            </p>
            <div className="mt-3 flex gap-3">
              <Link
                href="/app/onboarding"
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
              >
                Suivre le guide d'installation →
              </Link>
              <Link
                href="/settings"
                className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50"
              >
                J'ai déjà mes identifiants
              </Link>
            </div>
          </div>
          <Link
            href="/app/onboarding"
            aria-label="Fermer"
            className="flex-shrink-0 text-amber-400 hover:text-amber-600 text-xl leading-none"
          >
            ×
          </Link>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Total contacts", value: total, icon: "👥" },
          {
            label: "Joignables",
            value: reachable,
            icon: "✅",
            sub: total ? `${Math.round((reachable / total) * 100)}%` : "—",
          },
          {
            label: "Injoignables",
            value: unreachable,
            icon: "❌",
            sub: total ? `${Math.round((unreachable / total) * 100)}%` : "—",
          },
          { label: "Campagnes actives", value: running, icon: "📞" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl bg-white border border-gray-200 p-5">
            <div className="text-2xl mb-1">{kpi.icon}</div>
            <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
            <div className="text-sm text-gray-500">{kpi.label}</div>
            {kpi.sub && <div className="text-xs text-blue-600 font-medium mt-1">{kpi.sub}</div>}
          </div>
        ))}
      </div>

      {/* Campagnes récentes */}
      <div className="rounded-xl bg-white border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Campagnes récentes</h2>
          <Link href="/campaigns" className="text-sm text-blue-600 hover:underline">
            Voir tout →
          </Link>
        </div>

        {campaigns.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400">
            <p>Aucune campagne. Commencez par en créer une !</p>
            <Link
              href="/campaigns/new"
              className="mt-3 inline-block text-sm text-blue-600 hover:underline"
            >
              Créer une campagne →
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3 text-left">Nom</th>
                <th className="px-5 py-3 text-left">Statut</th>
                <th className="px-5 py-3 text-right">Contacts</th>
                <th className="px-5 py-3 text-right">Créée le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="font-medium text-gray-900 hover:text-blue-600"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status as CampaignStatus]}`}
                    >
                      {STATUS_LABELS[c.status as CampaignStatus]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-gray-600">{c._count.contacts}</td>
                  <td className="px-5 py-3 text-right text-gray-400">
                    {new Date(c.createdAt).toLocaleDateString("fr-FR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
