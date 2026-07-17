import { requireAccount } from "@/lib/session";
import {
  getSlotRates,
  getDaySlotRates,
  getResultDistribution,
  getCallSummary,
  getTagSlotStats,
  SLOT_LABEL,
} from "@/lib/dashboard";
import Link from "next/link";
import ScrollReveal from "@/components/ui/ScrollReveal";
import { SlotRateChart, DaySlotChart, ResultPieChart } from "./StatsChartsClient";

function fmt(sec: number | null): string {
  if (sec === null) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default async function StatsPage() {
  const ctx = await requireAccount();

  const [slotRates, daySlotRows, results, summary, tagStats] = await Promise.all([
    getSlotRates(ctx.accountId),
    getDaySlotRates(ctx.accountId),
    getResultDistribution(ctx.accountId),
    getCallSummary(ctx.accountId),
    getTagSlotStats(ctx.accountId),
  ]);

  return (
    <div className="space-y-8">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        className="flex items-start justify-between"
        style={{ animation: "slide-up-sm 0.5s cubic-bezier(0.16,1,0.3,1) both" }}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Statistiques avancées</h1>
          <p className="mt-0.5 text-sm text-gray-400">Analyse de joignabilité et de performance.</p>
        </div>
        <div className="flex gap-2">
          <a
            href="/api/export/prospects"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:border-red-200 hover:text-red-600 hover:bg-red-50/40 transition-all duration-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
          >
            ↓ Prospects CSV
          </a>
          <a
            href="/api/export/calls"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:border-red-200 hover:text-red-600 hover:bg-red-50/40 transition-all duration-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
          >
            ↓ Appels CSV
          </a>
        </div>
      </div>

      {/* ── Summary KPIs ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total appels", value: summary.totalAttempts.toLocaleString("fr-FR") },
          { label: "Décroché humain", value: summary.humanAnswers.toLocaleString("fr-FR") },
          { label: "Durée moy. appel", value: fmt(summary.avgDurationSec) },
          {
            label: "Meilleur créneau",
            value: summary.bestSlot ? `${summary.bestSlotRatePct}%` : "—",
            sub: summary.bestSlot ? SLOT_LABEL[summary.bestSlot] : "pas de données",
            highlight: !!summary.bestSlot,
          },
        ].map(({ label, value, sub, highlight }, i) => (
          <ScrollReveal key={label} delay={i * 0.07}>
            <div
              className={`rounded-2xl border p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] lift-card ${
                highlight
                  ? "border-red-100 bg-gradient-to-br from-red-50 to-rose-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                {label}
              </p>
              <p
                className={`mt-2 text-2xl font-bold tabular-nums ${
                  highlight ? "text-red-700" : "text-gray-900"
                }`}
              >
                {value}
              </p>
              {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
            </div>
          </ScrollReveal>
        ))}
      </div>

      {/* ── Slot answer rates ────────────────────────────────────────────── */}
      <ScrollReveal>
        <Section title="Taux de décroché par créneau" sub="Toutes campagnes, tous temps">
          <SlotRateChart rates={slotRates} />
          <div className="mt-5 grid grid-cols-3 gap-3">
            {slotRates.map((r, i) => (
              <ScrollReveal key={r.slot} delay={i * 0.07}>
                <div className="rounded-xl bg-gray-50/80 border border-gray-100 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    {r.label}
                  </p>
                  <p className="mt-1.5 text-xl font-bold text-gray-900">
                    {r.total === 0 ? <span className="text-gray-300">—</span> : `${r.ratePct}%`}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {r.total === 0 ? "Aucun appel" : `${r.humanAnswers} décrochés / ${r.total}`}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </Section>
      </ScrollReveal>

      {/* ── Day × slot ──────────────────────────────────────────────────── */}
      <ScrollReveal>
        <Section
          title="Taux de décroché par jour et créneau"
          sub="Lundi–Vendredi, taux de décroché en %"
        >
          <DaySlotChart rows={daySlotRows} />
        </Section>
      </ScrollReveal>

      {/* ── Result distribution ──────────────────────────────────────────── */}
      {results.length > 0 && (
        <ScrollReveal>
          <Section
            title="Répartition des résultats"
            sub="Distribution sur tous les appels terminés"
          >
            <ResultPieChart results={results} />
          </Section>
        </ScrollReveal>
      )}

      {/* ── Tag stats ───────────────────────────────────────────────────── */}
      {tagStats.length > 0 && (
        <ScrollReveal>
          <Section
            title="Meilleur créneau par segment"
            sub="Calculé sur les tentatives d'appel de chaque tag"
          >
            <div className="overflow-hidden rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Tag
                    </th>
                    <th className="px-4 py-3 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Tentatives
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Meilleur créneau
                    </th>
                    <th className="px-4 py-3 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Taux
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tagStats.map((t) => (
                    <tr key={t.tagId} className="hover:bg-gray-50/70 transition-colors group">
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm"
                          style={{ backgroundColor: t.tagColor }}
                        >
                          {t.tagName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-gray-500">
                        {t.totalAttempts.toLocaleString("fr-FR")}
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-sm">
                        {t.bestSlotLabel ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">
                        {t.bestRatePct !== null ? (
                          <span className="text-red-600">{t.bestRatePct}%</span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </ScrollReveal>
      )}

      <div className="pb-4 text-center">
        <Link
          href="/app"
          className="text-sm text-gray-400 hover:text-red-500 transition-colors font-medium"
        >
          ← Retour au tableau de bord
        </Link>
      </div>
    </div>
  );
}

function Section({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {children}
    </div>
  );
}
