// @ts-nocheck — pending rewrite (schema migration lot 2)
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Campaign } from "@/types";
import { ContactsTable } from "@/components/campaigns/contacts-table";
import { LaunchModal } from "@/components/campaigns/launch-modal";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  RUNNING: "En cours",
  PAUSED: "Pausée",
  COMPLETED: "Terminée",
};

export default function CampaignPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [showLaunch, setShowLaunch] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchCampaign = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setCampaign(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchCampaign();
    const interval = setInterval(fetchCampaign, 5000);
    return () => clearInterval(interval);
  }, [fetchCampaign]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Chargement…</div>;
  }

  if (!campaign) {
    return <div className="text-center py-16 text-gray-400">Campagne introuvable</div>;
  }

  const stats = (campaign.stats ?? {}) as Record<string, number>;
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  const reachable = stats.REACHABLE ?? 0;
  const pct = total ? Math.round((reachable / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/campaigns" className="text-sm text-gray-400 hover:text-gray-600">
              ← Campagnes
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-gray-500">{STATUS_LABELS[campaign.status]}</span>
            {campaign.status === "RUNNING" && (
              <span className="flex items-center gap-1 text-xs text-blue-600">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse inline-block" />
                Live
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <a
            href={`/api/campaigns/${id}/export`}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Export CSV
          </a>
          <Link
            href={`/campaigns/${id}/analytics`}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Analytics
          </Link>
          {campaign.status !== "COMPLETED" && (
            <button
              onClick={() => setShowLaunch(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              📞 Lancer les appels
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "Total", value: total, color: "text-gray-900" },
          { label: "Joignables ✅", value: stats.REACHABLE ?? 0, color: "text-green-600" },
          { label: "Injoignables ❌", value: stats.UNREACHABLE ?? 0, color: "text-red-600" },
          {
            label: "En attente ⏳",
            value: (stats.PENDING ?? 0) + (stats.CALLING ?? 0),
            color: "text-gray-500",
          },
          {
            label: "Faux numéros 📵",
            value: (stats.INVALID ?? 0) + (stats.BLOCKED ?? 0),
            color: "text-amber-600",
          },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-white border border-gray-200 p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="rounded-xl bg-white border border-gray-200 p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">Taux de joignabilité</span>
            <span className="font-semibold text-green-600">{pct}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Contacts table */}
      <div className="rounded-xl bg-white border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Contacts</h2>
        <ContactsTable campaignId={id} />
      </div>

      {showLaunch && (
        <LaunchModal
          campaignId={id}
          onClose={() => setShowLaunch(false)}
          onLaunched={fetchCampaign}
        />
      )}
    </div>
  );
}
