"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Plan, BillingCycle } from "@prisma/client";
import { PLAN_CONFIG, PLAN_ORDER, ADDITIONAL_PACK_CREDITS, ADDITIONAL_PACK_PRICE_CENTS } from "@/lib/plan-config";

interface Transaction {
  id: string;
  delta: number;
  reason: string;
  createdAt: string;
}

interface Props {
  plan: Plan;
  billingCycle: BillingCycle;
  extraCreditsMonthly: number;
  hasSubscription: boolean;
  subscriptionStatus: string | null;
  creditBalance: number;
  recentTransactions: Transaction[];
}

const REASON_LABELS: Record<string, string> = {
  CALL_ATTEMPT: "Appel composé",
  HUMAN_ANSWERED_SURCHARGE: "Décroché (surcharge)",
  MANUAL_TOP_UP: "Rechargement manuel",
  INITIAL_CREDIT: "Crédits initiaux",
  PLAN_MONTHLY_GRANT: "Attribution mensuelle",
  EXTRA_PACK_PURCHASE: "Pack supplémentaire",
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active:    { label: "Actif",     cls: "bg-green-100 text-green-700" },
  trialing:  { label: "Essai",     cls: "bg-blue-100 text-blue-700"  },
  past_due:  { label: "Impayé",    cls: "bg-orange-100 text-orange-700" },
  canceled:  { label: "Résilié",   cls: "bg-red-100 text-red-700"    },
  paused:    { label: "En pause",  cls: "bg-gray-100 text-gray-600"  },
};

function fmt(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export default function BillingView({
  plan: currentPlan,
  billingCycle: currentCycle,
  hasSubscription,
  subscriptionStatus,
  creditBalance,
  recentTransactions,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [cycle, setCycle] = useState<BillingCycle>(currentCycle);
  const [selectedPlan, setSelectedPlan] = useState<Plan>(currentPlan);
  const [packs, setPacks] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("sub_success") === "1") {
      setToast("Abonnement activé — vos crédits ont été crédités ✓");
      router.replace("/app/billing");
    } else if (searchParams.get("pack_success") === "1") {
      const n = searchParams.get("packs");
      setToast(`Pack de ${n ? parseInt(n) * ADDITIONAL_PACK_CREDITS : ADDITIONAL_PACK_CREDITS} crédits ajouté ✓`);
      router.replace("/app/billing");
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const colorMap = {
    blue:   { bg: "bg-blue-50",   border: "border-blue-200",   badge: "bg-blue-100 text-blue-700",    ring: "ring-blue-300"   },
    red:    { bg: "bg-red-50",    border: "border-red-200",    badge: "bg-red-100 text-red-700",      ring: "ring-red-300"    },
    purple: { bg: "bg-purple-50", border: "border-purple-200", badge: "bg-purple-100 text-purple-700", ring: "ring-purple-300" },
  };

  function redirect(url: string) {
    window.location.href = url;
  }

  function handleSubscribe() {
    startTransition(async () => {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "subscription", plan: selectedPlan, cycle }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) redirect(data.url);
    });
  }

  function handlePortal() {
    startTransition(async () => {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) redirect(data.url);
    });
  }

  function handleBuyPacks() {
    startTransition(async () => {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "pack", packs }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) redirect(data.url);
    });
  }

  const planChanged = selectedPlan !== currentPlan || cycle !== currentCycle;
  const statusInfo = subscriptionStatus ? (STATUS_BADGE[subscriptionStatus] ?? null) : null;

  return (
    <div className="space-y-10 max-w-4xl" style={{ animation: "slide-up-sm 0.4s cubic-bezier(0.16,1,0.3,1) both" }}>

      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 rounded-2xl bg-gray-900 text-white text-sm font-medium px-5 py-3 shadow-xl">
          {toast}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Abonnement & Crédits</h1>
          <p className="mt-1 text-sm text-gray-500">Gérez votre offre et vos crédits d&apos;appels.</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 mb-0.5">Solde actuel</p>
          <p className={`text-2xl font-bold ${creditBalance < 10 ? "text-orange-500" : "text-gray-900"}`}>
            {creditBalance.toLocaleString("fr-FR")}
            <span className="text-sm font-normal text-gray-400 ml-1">crédits</span>
          </p>
        </div>
      </div>

      {/* ── Status & portal ── */}
      {hasSubscription && (
        <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Abonnement</span>
            {statusInfo && (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusInfo.cls}`}>
                {statusInfo.label}
              </span>
            )}
          </div>
          <button
            onClick={handlePortal}
            disabled={isPending}
            className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Gérer l&apos;abonnement →
          </button>
        </div>
      )}

      {/* ── Cycle toggle ── */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700">Facturation</span>
        <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
          {(["MONTHLY", "ANNUAL"] as BillingCycle[]).map((c) => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${
                cycle === c ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {c === "MONTHLY" ? "Mensuel" : "Annuel"}
            </button>
          ))}
        </div>
        {cycle === "ANNUAL" && (
          <span className="rounded-full bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1">
            −30 %
          </span>
        )}
      </div>

      {/* ── Plan cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLAN_ORDER.map((p) => {
          const cfg = PLAN_CONFIG[p];
          const colors = colorMap[cfg.color];
          const isActive = p === currentPlan;
          const isSelected = p === selectedPlan;
          const price = cycle === "ANNUAL" ? cfg.annualPriceCents : cfg.monthlyPriceCents;

          return (
            <button
              key={p}
              onClick={() => setSelectedPlan(p)}
              className={`relative text-left rounded-2xl border-2 p-5 transition-all ${
                isSelected
                  ? `${colors.border} ${colors.bg} ring-2 ${colors.ring} ring-offset-1`
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              {isActive && (
                <span className={`absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full ${colors.badge}`}>
                  Actuel
                </span>
              )}
              <p className="text-base font-bold text-gray-900">{cfg.label}</p>
              <p className="mt-2">
                <span className="text-3xl font-extrabold text-gray-900">{fmt(price)}</span>
                <span className="text-xs text-gray-400 ml-1">/mois</span>
              </p>
              {cycle === "ANNUAL" && (
                <p className="text-[11px] text-gray-400 mt-0.5">soit {fmt(price * 12)}/an</p>
              )}
              <ul className="mt-4 space-y-1.5">
                {cfg.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="mt-0.5 text-green-500 font-bold">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      {/* ── Subscribe / change plan CTA ── */}
      <div className="flex items-center gap-4">
        {!hasSubscription ? (
          <button
            onClick={handleSubscribe}
            disabled={isPending}
            className="rounded-xl bg-red-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-all shadow-sm"
          >
            {isPending ? "Redirection…" : `Souscrire à ${PLAN_CONFIG[selectedPlan].label}`}
          </button>
        ) : planChanged ? (
          <button
            onClick={handlePortal}
            disabled={isPending}
            className="rounded-xl bg-red-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-all shadow-sm"
          >
            {isPending ? "Redirection…" : "Changer d'offre via le portail →"}
          </button>
        ) : null}
        {!hasSubscription && (
          <p className="text-xs text-gray-400">Vous serez redirigé vers Stripe pour payer en sécurité.</p>
        )}
      </div>

      {/* ── Extra credit packs ── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">Crédits supplémentaires</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {ADDITIONAL_PACK_CREDITS.toLocaleString("fr-FR")} crédits = {fmt(ADDITIONAL_PACK_PRICE_CENTS)} · paiement unique
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-1">
            <button
              onClick={() => setPacks((n) => Math.max(1, n - 1))}
              className="h-8 w-8 rounded-lg text-sm font-bold text-gray-700 hover:bg-white transition-all"
            >
              −
            </button>
            <span className="w-8 text-center text-sm font-bold text-gray-900">{packs}</span>
            <button
              onClick={() => setPacks((n) => Math.min(10, n + 1))}
              className="h-8 w-8 rounded-lg text-sm font-bold text-gray-700 hover:bg-white transition-all"
            >
              +
            </button>
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-700">
              {(packs * ADDITIONAL_PACK_CREDITS).toLocaleString("fr-FR")} crédits
              <span className="ml-2 text-gray-400 text-xs">= {fmt(packs * ADDITIONAL_PACK_PRICE_CENTS)}</span>
            </p>
          </div>
          <button
            onClick={handleBuyPacks}
            disabled={isPending}
            className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50 transition-all"
          >
            {isPending ? "Redirection…" : "Acheter →"}
          </button>
        </div>
      </div>

      {/* ── Credit history ── */}
      {recentTransactions.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">Historique des crédits</p>
          </div>
          <div className="divide-y divide-gray-100">
            {recentTransactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm text-gray-700">{REASON_LABELS[t.reason] ?? t.reason}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(t.createdAt).toLocaleDateString("fr-FR", {
                      day: "numeric", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
                <span className={`text-sm font-bold ${t.delta > 0 ? "text-green-600" : "text-red-500"}`}>
                  {t.delta > 0 ? "+" : ""}{t.delta.toLocaleString("fr-FR")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
