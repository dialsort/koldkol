"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ProspectList {
  id: string;
  name: string;
  _count: { prospects: number };
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  createdAt: string | Date;
  _count: { callAttempts: number };
  prospectLists: {
    prospectList: ProspectList;
  }[];
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  PAUSED: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-gray-100 text-gray-600",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  PAUSED: "Suspendue",
  COMPLETED: "Terminée",
};

function CreateModal({
  prospectLists,
  onClose,
  onCreated,
}: {
  prospectLists: ProspectList[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleList(id: string) {
    setSelectedLists((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), prospectListIds: selectedLists }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setError(d.error ?? "Erreur lors de la création");
        return;
      }
      onCreated();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Nouvelle campagne</h2>
          <p className="text-sm text-gray-400 mt-0.5">Donnez un nom et associez des listes de prospects.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom de la campagne <span className="text-red-500">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Ex : Prospection janvier 2026"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
            />
          </div>

          {prospectLists.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Listes de prospects
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto rounded-xl border border-gray-200 p-2">
                {prospectLists.map((list) => (
                  <label
                    key={list.id}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                      selectedLists.includes(list.id)
                        ? "bg-red-50 border border-red-200"
                        : "hover:bg-gray-50 border border-transparent"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedLists.includes(list.id)}
                      onChange={() => toggleList(list.id)}
                      className="accent-red-600"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{list.name}</p>
                      <p className="text-xs text-gray-400">{list._count.prospects} prospects</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPending || !name.trim()}
              className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Création…" : "Créer la campagne"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CampaignsView({
  campaigns: initial,
  prospectLists,
}: {
  campaigns: Campaign[];
  prospectLists: ProspectList[];
}) {
  const [campaigns, setCampaigns] = useState(initial);
  const [showCreate, setShowCreate] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const router = useRouter();

  async function handleToggle(c: Campaign) {
    if (c.status === "COMPLETED") return;
    const next = c.status === "PAUSED" ? "ACTIVE" : "PAUSED";
    setTogglingId(c.id);
    try {
      const res = await fetch(`/api/campaigns/${c.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) {
        setCampaigns((prev) =>
          prev.map((x) => (x.id === c.id ? { ...x, status: next } : x))
        );
      }
    } finally {
      setTogglingId(null);
    }
  }

  function handleCreated() {
    setShowCreate(false);
    router.refresh();
  }

  const totalProspects = (c: Campaign) =>
    c.prospectLists.reduce((s, pl) => s + pl.prospectList._count.prospects, 0);

  return (
    <>
      {showCreate && (
        <CreateModal
          prospectLists={prospectLists}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}

      <div className="flex justify-end">
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors shadow-sm"
        >
          + Nouvelle campagne
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6.29 6.29l.98-.98a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </div>
          <p className="text-base font-semibold text-gray-700 mb-1">Aucune campagne</p>
          <p className="text-sm text-gray-400 mb-5">Créez votre première campagne pour commencer à appeler.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
          >
            Créer une campagne
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const prospects = totalProspects(c);
            const isToggling = togglingId === c.id;

            return (
              <div
                key={c.id}
                className="relative rounded-2xl border border-gray-200 bg-white px-5 py-4 flex items-center gap-4 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                {/* Zone cliquable qui couvre toute la carte */}
                <Link href={`/app/campaigns/${c.id}`} className="absolute inset-0 rounded-2xl" aria-label={c.name} />

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 truncate">{c.name}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[c.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {prospects > 0 ? `${prospects} prospect${prospects > 1 ? "s" : ""}` : "Aucun prospect"}
                    {c.prospectLists.length > 0 && ` · ${c.prospectLists.length} liste${c.prospectLists.length > 1 ? "s" : ""}`}
                    {c._count.callAttempts > 0 && ` · ${c._count.callAttempts} appel${c._count.callAttempts > 1 ? "s" : ""}`}
                    {" · créée le "}
                    {new Date(c.createdAt).toLocaleDateString("fr-FR")}
                  </p>
                  {c.prospectLists.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {c.prospectLists.map(({ prospectList: pl }) => (
                        <span key={pl.id} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                          {pl.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative z-10 flex items-center gap-2 shrink-0">
                  <Link
                    href={`/app/session?campaignId=${c.id}`}
                    className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
                  >
                    Appeler →
                  </Link>
                  {c.status !== "COMPLETED" && (
                    <button
                      onClick={() => void handleToggle(c)}
                      disabled={isToggling}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-50 ${
                        c.status === "PAUSED"
                          ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                          : "border-gray-200 text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      {isToggling ? "…" : c.status === "PAUSED" ? "▶ Reprendre" : "⏸ Suspendre"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
