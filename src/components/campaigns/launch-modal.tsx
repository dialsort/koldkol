// @ts-nocheck — pending rewrite (schema migration lot 2)
"use client";

import { useState } from "react";
import { DEFAULT_SLOTS } from "@/lib/constants";

export function LaunchModal({
  campaignId,
  onClose,
  onLaunched,
}: {
  campaignId: string;
  onClose: () => void;
  onLaunched: () => void;
}) {
  const [slots, setSlots] = useState<number[]>(DEFAULT_SLOTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const allSlots = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

  function toggleSlot(h: number) {
    setSlots((prev) =>
      prev.includes(h) ? prev.filter((s) => s !== h) : [...prev, h].sort((a, b) => a - b)
    );
  }

  async function launch() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/campaigns/${campaignId}/launch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmed }),
    });

    const data = await res.json();

    if (res.ok && data.warning) {
      setWarning(data.message);
      setConfirmed(true);
      setLoading(false);
      return;
    }

    if (!res.ok) {
      setError(data.error || "Erreur lors du lancement");
      setLoading(false);
      return;
    }

    setLoading(false);
    onLaunched();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Lancer la campagne</h2>

        <p className="text-sm text-gray-500 mb-4">
          Sélectionnez les créneaux horaires pour les appels automatiques :
        </p>

        <div className="flex flex-wrap gap-2 mb-6">
          {allSlots.map((h) => (
            <button
              key={h}
              onClick={() => toggleSlot(h)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                slots.includes(h)
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {h}h
            </button>
          ))}
        </div>

        {warning && (
          <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
            ⚠️ {warning}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Annuler
          </button>
          <button
            onClick={launch}
            disabled={loading || slots.length === 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Lancement…" : warning ? "Confirmer le lancement" : "Lancer les appels"}
          </button>
        </div>
      </div>
    </div>
  );
}
