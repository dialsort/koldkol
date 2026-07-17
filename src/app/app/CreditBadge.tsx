"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { Plan } from "@prisma/client";

const SURCHARGE: Record<Plan, number> = { ESSENTIEL: 6, PRO: 4, EXPERT: 3 };

export default function CreditBadge({ initialBalance, plan }: { initialBalance: number; plan: Plan }) {
  const [balance] = useState(initialBalance);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const low = balance < 10;
  const surcharge = SURCHARGE[plan];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
          low
            ? "border-orange-200 bg-orange-50 text-orange-600"
            : "border-gray-100 bg-gray-50 text-gray-600"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${low ? "bg-orange-400" : "bg-green-400"}`} />
        {balance} crédit{balance !== 1 ? "s" : ""}
        <span className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-current text-[9px] font-bold opacity-60">
          i
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-gray-200 bg-white shadow-xl z-[9999] overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Crédits</p>
            <p className="text-2xl font-bold text-gray-900">
              {balance}
              <span className="text-sm font-normal text-gray-400 ml-1">crédit{balance !== 1 ? "s" : ""}</span>
            </p>
            {low && (
              <p className="mt-1 text-[11px] text-orange-500 font-medium">Solde faible — rechargez bientôt.</p>
            )}
          </div>

          <div className="px-4 py-3 border-b border-gray-100 space-y-1.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Comment ça marche</p>
            <div className="flex items-start gap-2 text-xs text-gray-600">
              <span className="mt-0.5 text-red-500">•</span>
              <span><b>1 appel composé = 1 crédit</b> (pas décroché)</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-gray-600">
              <span className="mt-0.5 text-red-500">•</span>
              <span><b>Décroché par un humain = {surcharge} crédits</b> (votre offre)</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-gray-600">
              <span className="mt-0.5 text-red-500">•</span>
              <span>Répondeur détecté = 1 crédit uniquement</span>
            </div>
          </div>

          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recharger</p>
            <Link
              href="/app/billing"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between w-full rounded-lg bg-red-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
            >
              <span>Acheter des crédits</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
