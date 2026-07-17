"use client";

import { useState } from "react";
import { ADDITIONAL_PACK_CREDITS, ADDITIONAL_PACK_PRICE_CENTS } from "@/lib/plan-config";

interface LedgerEntry {
  id: string;
  delta: number;
  reason: string;
  relatedCallAttemptId: string | null;
  createdAt: string;
}

interface Props {
  balance: number;
  ledger: LedgerEntry[];
  plan: string;
  monthlyCredits: number;
}

const REASON_LABEL: Record<string, string> = {
  PLAN_MONTHLY_GRANT: "Attribution mensuelle",
  PLAN_MONTHLY_EXPIRY: "Expiration crédits plan",
  CREDIT_PURCHASE: "Achat de crédits",
  CALL_ATTEMPT: "Appel lancé",
  HUMAN_ANSWERED_SURCHARGE: "Surcoût décroché humain",
};

const REASON_ICON: Record<string, string> = {
  PLAN_MONTHLY_GRANT: "◈",
  PLAN_MONTHLY_EXPIRY: "◎",
  CREDIT_PURCHASE: "⊕",
  CALL_ATTEMPT: "◷",
  HUMAN_ANSWERED_SURCHARGE: "◆",
};

export default function CreditsView({ balance, ledger, plan, monthlyCredits }: Props) {
  const [packs, setPacks] = useState(1);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);

  const totalCredits = packs * ADDITIONAL_PACK_CREDITS;
  const totalEuros = ((packs * ADDITIONAL_PACK_PRICE_CENTS) / 100).toFixed(2);

  async function handlePurchase() {
    setBuying(true);
    setBuyError(null);
    try {
      const res = await fetch("/api/credits/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packs }),
      });
      const data = (await res.json()) as { error?: string; detail?: string };
      setBuyError(data.detail ?? data.error ?? "Erreur inconnue");
    } catch {
      setBuyError("Erreur réseau");
    } finally {
      setBuying(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Balance + plan card ──────────────────────────────────────────── */}
      <div
        className="rounded-2xl border border-gray-200 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
        style={{ animation: "slide-up-sm 0.4s cubic-bezier(0.16,1,0.3,1) both" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
              Solde disponible
            </p>
            <p className="mt-2 text-5xl font-bold tabular-nums text-gray-900">
              {balance.toLocaleString("fr-FR")}
            </p>
            <p className="mt-1 text-xs text-gray-400">crédits</p>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center rounded-xl border border-red-100 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700">
              {plan}
            </span>
            <p className="mt-2 text-xs text-gray-400">
              {monthlyCredits.toLocaleString("fr-FR")} crédits / mois
            </p>
          </div>
        </div>

        {/* Balance bar */}
        <div className="mt-5">
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-red-500 to-rose-400 transition-all duration-700"
              style={{ width: `${Math.min((balance / monthlyCredits) * 100, 100)}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-gray-400">
            <span>0</span>
            <span>{monthlyCredits.toLocaleString("fr-FR")}</span>
          </div>
        </div>
      </div>

      {/* ── Purchase widget ──────────────────────────────────────────────── */}
      <div
        className="rounded-2xl border border-gray-200 bg-white p-6 space-y-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
        style={{ animation: "slide-up-sm 0.5s cubic-bezier(0.16,1,0.3,1) both" }}
      >
        <div>
          <h2 className="text-base font-semibold text-gray-900">Acheter des crédits</h2>
          <p className="mt-0.5 text-xs text-gray-400">
            1 pack = {ADDITIONAL_PACK_CREDITS.toLocaleString("fr-FR")} crédits —{" "}
            {(ADDITIONAL_PACK_PRICE_CENTS / 100).toFixed(2).replace(".", ",")} € HT
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={packs}
              onChange={(e) => setPacks(parseInt(e.target.value))}
              className="flex-1 accent-red-600"
            />
            <span className="w-8 text-center text-sm font-bold text-gray-700">{packs}</span>
          </div>

          <div className="rounded-xl bg-gray-50 border border-gray-100 px-5 py-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">
                {packs} pack{packs > 1 ? "s" : ""}
              </p>
              <p className="text-sm font-semibold text-gray-800 mt-0.5">
                {totalCredits.toLocaleString("fr-FR")} crédits
              </p>
            </div>
            <p className="text-xl font-bold text-gray-900">
              {totalEuros.replace(".", ",")}
              <span className="text-sm font-normal text-gray-400 ml-1">€ HT</span>
            </p>
          </div>
        </div>

        <button
          onClick={handlePurchase}
          disabled={buying}
          className="btn-red w-full py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {buying ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="dialer-spinner h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"
                  strokeLinecap="round"
                />
              </svg>
              Traitement…
            </span>
          ) : (
            "Acheter maintenant"
          )}
        </button>

        {buyError && (
          <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-xs text-amber-700 text-center">
            Paiement non configuré — intégration Stripe à venir.
          </div>
        )}
      </div>

      {/* ── Ledger ──────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
        style={{ animation: "slide-up-sm 0.6s cubic-bezier(0.16,1,0.3,1) both" }}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Historique des transactions</h2>
          <span className="text-xs text-gray-400">{ledger.length} entrées</span>
        </div>

        {ledger.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400">Aucune transaction</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50/70 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  Motif
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  Crédits
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ledger.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50/70 transition-colors group">
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap tabular-nums">
                    {new Date(entry.createdAt).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <span className="flex items-center gap-2">
                      <span className="text-gray-300 text-xs">
                        {REASON_ICON[entry.reason] ?? "○"}
                      </span>
                      {REASON_LABEL[entry.reason] ?? entry.reason}
                    </span>
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono font-semibold tabular-nums ${
                      entry.delta >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {entry.delta >= 0 ? "+" : ""}
                    {entry.delta.toLocaleString("fr-FR")}
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
