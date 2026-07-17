"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function CampaignDetailClient({
  campaignId,
  initialStatus,
}: {
  campaignId: string;
  initialStatus: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [isPending, startTransition] = useTransition();
  const [confirmComplete, setConfirmComplete] = useState(false);
  const router = useRouter();

  function patchStatus(next: string) {
    startTransition(async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) {
        setStatus(next);
        router.refresh();
      }
    });
  }

  if (status === "COMPLETED") {
    return (
      <span className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-400">
        Terminée
      </span>
    );
  }

  return (
    <>
      {confirmComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setConfirmComplete(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="font-semibold text-gray-900">Terminer la campagne ?</h2>
              <p className="text-sm text-gray-400 mt-1">
                Cette action est irréversible. La campagne ne pourra plus être relancée ni modifiée.
              </p>
            </div>
            <div className="flex gap-3 p-4">
              <button
                onClick={() => setConfirmComplete(false)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                disabled={isPending}
                onClick={() => { setConfirmComplete(false); patchStatus("COMPLETED"); }}
                className="flex-1 rounded-xl bg-gray-800 py-2.5 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-50 transition-colors"
              >
                {isPending ? "…" : "Terminer"}
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => void patchStatus(status === "PAUSED" ? "ACTIVE" : "PAUSED")}
        disabled={isPending}
        className={`rounded-xl border px-4 py-2 text-sm font-medium transition-all disabled:opacity-50 ${
          status === "PAUSED"
            ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
            : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
        }`}
      >
        {isPending ? "…" : status === "PAUSED" ? "▶ Reprendre" : "⏸ Suspendre"}
      </button>

      <button
        onClick={() => setConfirmComplete(true)}
        disabled={isPending}
        className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
      >
        Terminer
      </button>
    </>
  );
}
