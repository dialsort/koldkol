import { requireAccount } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getBalance } from "@/lib/credits";
import {
  getSlotRates,
  getTodayVolume,
  getCampaignKpis,
  getPendingCallbackCount,
  getQueuePreview,
} from "@/lib/dashboard";
import Link from "next/link";
import AnimNumber from "@/components/ui/AnimNumber";
import SlotChart from "./SlotChartClient";
import type { Slot } from "@/types";

// Current legal slot based on France rules
function getCurrentSlot(date: Date): { slot: Slot | null; label: string; nextLabel: string } {
  const day = date.getDay(); // 0=Sun, 6=Sat
  const h = date.getHours();
  const isWeekday = day >= 1 && day <= 5;

  if (!isWeekday) return { slot: null, label: "Week-end", nextLabel: "Lundi 10h00" };
  if (h < 10) return { slot: null, label: `Ouverture à 10h00`, nextLabel: "10h00" };
  if (h < 13) return { slot: "MATIN", label: "Matin — 10h–13h", nextLabel: "14h00" };
  if (h < 14) return { slot: null, label: "Pause déjeuner", nextLabel: "14h00" };
  if (h < 17) return { slot: "DEBUT_APREM", label: "Après-midi — 14h–17h", nextLabel: "17h00" };
  if (h < 20) return { slot: "FIN_APREM", label: "Soirée — 17h–20h", nextLabel: "20h00" };
  return { slot: null, label: "Plage fermée", nextLabel: "Demain 10h00" };
}

const SLOT_LABEL: Record<Slot, string> = {
  MATIN: "Matin",
  DEBUT_APREM: "Après-midi",
  FIN_APREM: "Soirée",
};

export default async function AppPage() {
  const ctx = await requireAccount();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const [conn, slotRates, todayVolume, campaigns, pendingCallbacks, balance, queue] =
    await Promise.all([
      prisma.twilioConnection.findUnique({
        where: { accountId: ctx.accountId },
        select: { status: true },
      }),
      getSlotRates(ctx.accountId),
      getTodayVolume(ctx.accountId, todayStart),
      getCampaignKpis(ctx.accountId),
      getPendingCallbackCount(ctx.accountId, now),
      getBalance(ctx.accountId),
      getQueuePreview(ctx.accountId, now),
    ]);

  const { slot: currentSlot, label: slotLabel } = getCurrentSlot(now);
  const isOpen = currentSlot !== null;

  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE").length;

  const dateLabel = now.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const bestSlot = slotRates.reduce(
    (best, r) => (r.ratePct > (best?.ratePct ?? -1) && r.total > 0 ? r : best),
    null as (typeof slotRates)[0] | null,
  );

  return (
    <div
      className="space-y-6"
      style={{ animation: "slide-up-sm 0.45s cubic-bezier(0.16,1,0.3,1) both" }}
    >
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 px-8 py-10 shadow-xl">
        {/* Subtle red glow */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-red-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-8 -bottom-8 h-48 w-48 rounded-full bg-red-800/15 blur-2xl" />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            {/* Slot badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1">
              <span
                className={`h-1.5 w-1.5 rounded-full ${isOpen ? "bg-green-400 animate-pulse" : "bg-gray-500"}`}
              />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-white/60">
                {slotLabel}
              </span>
            </div>

            <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl">
              Bonjour
              <span className="block text-red-400">{dateLabel}</span>
            </h1>

            <p className="text-sm text-white/40">
              {activeCampaigns > 0
                ? `${activeCampaigns} campagne${activeCampaigns > 1 ? "s" : ""} active${activeCampaigns > 1 ? "s" : ""}`
                : "Aucune campagne active"}
              {pendingCallbacks > 0 && (
                <> · <span className="text-amber-400 font-medium">{pendingCallbacks} callback{pendingCallbacks > 1 ? "s" : ""}</span></>
              )}
            </p>
          </div>

          {/* Primary CTA */}
          <div className="flex flex-col gap-2 sm:items-end sm:shrink-0">
            <Link
              href="/app/session"
              className={`inline-flex items-center gap-2 rounded-2xl px-7 py-3.5 text-sm font-bold transition-all duration-200 shadow-lg ${
                isOpen
                  ? "bg-red-600 text-white hover:bg-red-500 hover:shadow-red-500/40 hover:-translate-y-0.5"
                  : "bg-white/10 text-white/50 cursor-not-allowed pointer-events-none"
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6.29 6.29l.98-.98a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              Lancer la session
            </Link>
            {!isOpen && (
              <p className="text-[11px] text-white/30 text-center sm:text-right">
                Hors plage légale d&apos;appel
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Twilio alert ──────────────────────────────────────────────── */}
      {conn?.status !== "CONNECTED" && (
        <div className="flex items-center justify-between rounded-2xl border border-amber-200/60 bg-amber-50 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <p className="text-sm text-amber-800 font-medium">
              Twilio non configuré — les appels sont désactivés
            </p>
          </div>
          <Link
            href="/app/twilio"
            className="shrink-0 rounded-xl bg-amber-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-amber-600 transition-colors"
          >
            Configurer →
          </Link>
        </div>
      )}

      {/* ── KPI strip ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12" /><path d="M1.61 3.18 A2 2 0 0 1 3.6 1h3" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ),
            label: "Appels aujourd'hui",
            value: todayVolume.total,
            color: "text-gray-900",
          },
          {
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" />
              </svg>
            ),
            label: "Crédits",
            value: balance,
            href: "/app/credits",
            color: balance < 10 ? "text-red-600" : "text-gray-900",
          },
          {
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
            ),
            label: "Callbacks",
            value: pendingCallbacks,
            color: pendingCallbacks > 0 ? "text-amber-600" : "text-gray-900",
          },
          {
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            ),
            label: "Meilleur créneau",
            valueStr: bestSlot && bestSlot.total > 0
              ? `${bestSlot.ratePct}% · ${SLOT_LABEL[bestSlot.slot]}`
              : "—",
            color: "text-gray-900",
          },
        ].map(({ icon, label, value, valueStr, href, color }) => {
          const card = (
            <div className="group rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-[0_1px_4px_rgba(0,0,0,0.05)] hover:border-gray-300 hover:shadow-md transition-all duration-200">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-gray-400">{icon}</span>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide leading-none">
                  {label}
                </p>
              </div>
              <p className={`text-2xl font-bold tabular-nums ${color}`}>
                {valueStr ?? (value !== undefined ? <AnimNumber value={value as number} /> : "—")}
              </p>
            </div>
          );
          return href ? (
            <Link key={label} href={href}>
              {card}
            </Link>
          ) : (
            <div key={label}>{card}</div>
          );
        })}
      </div>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-5">
        {/* Queue */}
        <div className="lg:col-span-3 rounded-2xl border border-gray-200 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">File d&apos;appel prioritaire</h2>
              {queue.kind === "ok" && (
                <p className="text-[11px] text-gray-400 mt-0.5">{queue.slotLabel}</p>
              )}
            </div>
            {queue.kind === "ok" && (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-50 border border-green-200 text-[10px] font-bold text-green-600">
                {queue.items.length}
              </span>
            )}
          </div>

          {queue.kind === "outside_window" && (
            <div className="px-6 py-8 text-center">
              <div className="h-10 w-10 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-500">Hors plage légale d&apos;appel</p>
              <p className="text-xs text-gray-400 mt-1">
                Prochaine ouverture :{" "}
                {new Date(queue.nextWindow).toLocaleString("fr-FR", {
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          )}

          {queue.kind === "empty" && (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-gray-400">Aucun prospect dans la file</p>
            </div>
          )}

          {queue.kind === "ok" && (
            <>
              <div className="divide-y divide-gray-50/80">
                {queue.items.slice(0, 5).map((item, i) => (
                  <div key={item.prospectId} className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50/60 transition-colors">
                    <span className="w-4 shrink-0 text-center text-xs font-mono text-gray-300">
                      {i + 1}
                    </span>
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-red-100 to-rose-100 border border-red-200/50 flex items-center justify-center text-xs font-bold text-red-600 shrink-0">
                      {(item.company ?? item.contactName ?? "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {item.company ?? item.contactName ?? item.phoneNumber}
                      </p>
                      <p className="text-[11px] font-mono text-gray-400">{item.phoneNumber}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.isCallback && (
                        <span className="rounded-full bg-blue-50 border border-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                          Callback
                        </span>
                      )}
                      {item.isExploration && (
                        <span className="rounded-full bg-violet-50 border border-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-600">
                          Nouveau
                        </span>
                      )}
                      {item.scorePct !== null && !item.isCallback && !item.isExploration && (
                        <span className="text-xs font-medium text-gray-300">{item.scorePct}%</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-6 py-4 border-t border-gray-100">
                <Link
                  href="/app/session"
                  className="btn-red flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white w-full"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Démarrer la session
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Slot chart */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Taux de décroché</h2>
              {bestSlot && bestSlot.total > 0 && (
                <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-100 rounded-full px-2.5 py-0.5">
                  ↑ {bestSlot.ratePct}% {SLOT_LABEL[bestSlot.slot]}
                </span>
              )}
            </div>
            <SlotChart rates={slotRates} />
            <div className="mt-4 grid grid-cols-3 gap-2">
              {slotRates.map((r) => (
                <div key={r.slot} className="rounded-xl bg-gray-50 px-3 py-2.5 text-center border border-gray-100">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                    {SLOT_LABEL[r.slot]}
                  </p>
                  <p className="text-base font-bold text-gray-900">
                    {r.total === 0 ? (
                      <span className="text-gray-300 text-sm">—</span>
                    ) : (
                      <AnimNumber value={r.ratePct} suffix="%" />
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Campaigns mini */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Campagnes</h2>
              <span className="text-[11px] text-gray-400 font-medium">{activeCampaigns} active{activeCampaigns > 1 ? "s" : ""}</span>
            </div>
            {campaigns.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-400 text-center">
                Aucune campagne
              </p>
            ) : (
              <div className="divide-y divide-gray-50">
                {campaigns.slice(0, 4).map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/70 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                      <p className="text-[11px] text-gray-400">{c.total} prospects</p>
                    </div>
                    <span
                      className={`shrink-0 ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        c.status === "ACTIVE"
                          ? "bg-green-50 text-green-600 border border-green-100"
                          : c.status === "PAUSED"
                            ? "bg-amber-50 text-amber-600 border border-amber-100"
                            : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {c.status === "ACTIVE" ? "Active" : c.status === "PAUSED" ? "Pause" : "Finie"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
