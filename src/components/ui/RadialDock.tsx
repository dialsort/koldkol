"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useCallContext } from "@/contexts/CallContext";

const SLOT_HOURS: Record<string, string> = {
  MATIN: "10h–13h",
  DEBUT_APREM: "14h–17h",
  FIN_APREM: "17h–20h",
};

function WaveInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Système à 3 vagues</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4 text-sm text-gray-700">
          <p className="text-gray-500 text-xs">
            Le numéroteur appelle chaque prospect jusqu'à 3 fois en changeant de créneau à chaque tentative.
          </p>

          <div className="space-y-3">
            {[
              { wave: 1, label: "1ʳᵉ vague", desc: "Appelle tous les prospects de la liste une première fois, dans le créneau actuel." },
              { wave: 2, label: "2ᵉ vague", desc: "Rappelle les prospects sans réponse. Doit être lancée dans un créneau différent." },
              { wave: 3, label: "3ᵉ vague", desc: "Dernier essai pour les encore injoignables. Un 3ᵉ créneau différent est nécessaire." },
            ].map(({ wave, label, desc }) => (
              <div key={wave} className="flex gap-3">
                <span className="shrink-0 h-6 w-6 rounded-full bg-red-100 text-red-700 text-xs font-bold flex items-center justify-center">{wave}</span>
                <div>
                  <p className="font-semibold text-gray-800">{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 space-y-1.5">
            <p className="text-xs font-semibold text-amber-800">⏰ Quand relancer ?</p>
            <div className="text-xs text-amber-700 space-y-0.5">
              {Object.entries(SLOT_HOURS).map(([slot, hours]) => (
                <p key={slot}>
                  <span className="font-medium">{slot === "MATIN" ? "Matin" : slot === "DEBUT_APREM" ? "Début AM" : "Fin AM"}</span>
                  {" · "}{hours}
                </p>
              ))}
            </div>
            <p className="text-xs text-amber-600 pt-1">
              Exemple : vague 1 le matin → revenir à 14h pour la vague 2 → revenir à 17h pour la vague 3.
            </p>
          </div>

          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-xs font-semibold text-red-700">🚫 Numéros invalides</p>
            <p className="text-xs text-red-600 mt-0.5">
              Détectés automatiquement et exclus définitivement de tous vos contacts.
            </p>
          </div>

          <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
            <p className="text-xs font-semibold text-gray-700">✅ Après 3 vagues</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Les prospects injoignables après 3 créneaux différents sont classés dans le bilan comme "pas de réponse".
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const STATUS_DOT: Record<string, string> = {
  idle: "bg-gray-400",
  registering: "bg-yellow-400 animate-pulse",
  ready: "bg-green-500",
  ringing: "bg-red-500 animate-pulse",
  connected: "bg-green-500",
  error: "bg-red-500",
  api_key_required: "bg-orange-400",
};

const STATUS_LABEL: Record<string, string> = {
  idle: "En attente",
  registering: "Connexion…",
  ready: "Prêt",
  ringing: "Sonnerie…",
  connected: "En ligne",
  error: "Erreur",
  api_key_required: "Clé API manquante",
};

function fmt(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

interface ProspectOption {
  id: string;
  contactName: string | null;
  company: string | null;
  phoneNumber: string;
}

function ProspectSearch({
  campaignId,
  selected,
  onSelect,
}: {
  campaignId: string;
  selected: ProspectOption | null;
  onSelect: (p: ProspectOption | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProspectOption[]>([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const search = useCallback(
    (q: string) => {
      if (!campaignId) return;
      fetch(`/api/dialer/${campaignId}/prospects?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { prospects: [] }))
        .then((d: { prospects: ProspectOption[] }) => setResults(d.prospects))
        .catch(() => null);
    },
    [campaignId]
  );

  useEffect(() => {
    if (!open) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(query), 250);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, open, search]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-red-800 truncate">
            {selected.contactName ?? selected.company ?? selected.phoneNumber}
          </p>
          {selected.contactName && selected.company && (
            <p className="text-xs text-red-500 truncate">{selected.company}</p>
          )}
          <p className="text-xs font-mono text-red-400">{selected.phoneNumber}</p>
        </div>
        <button
          onClick={() => onSelect(null)}
          className="shrink-0 text-red-400 hover:text-red-600 text-lg leading-none"
          aria-label="Désélectionner"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        placeholder="Rechercher un prospect…"
        value={query}
        onFocus={() => { setOpen(true); search(query); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-red-400 focus:bg-white focus:outline-none transition-all"
      />
      {open && results.length > 0 && (
        <ul className="absolute bottom-full mb-1 left-0 right-0 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden z-10 max-h-48 overflow-y-auto">
          {results.map((p) => (
            <li key={p.id}>
              <button
                className="w-full text-left px-3 py-2 hover:bg-red-50 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(p);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <p className="text-sm font-medium text-gray-800 truncate">
                  {p.contactName ?? p.company ?? p.phoneNumber}
                </p>
                {p.contactName && p.company && (
                  <p className="text-xs text-gray-400 truncate">{p.company}</p>
                )}
                <p className="text-xs font-mono text-gray-400">{p.phoneNumber}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function RadialDock() {
  const [open, setOpen] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<ProspectOption | null>(null);
  const [showWaveInfo, setShowWaveInfo] = useState(false);

  const {
    softphone, campaigns, campaignId, setCampaignId, phase,
    callSeconds, dialSeconds, prospectInfo, flashOn, dialError,
    nextWindow, nextWindowReason, pauseLoading, campaignStatuses,
    autoMode, autoCountdown, waveNumber,
    toggleAutoMode, callNext, handleAccept, handleHangup,
    handleNextAfterWrap, toggleCampaignPause,
  } = useCallContext();

  // Reset selected prospect when campaign changes
  useEffect(() => { setSelectedProspect(null); }, [campaignId]);

  const isCampaignPaused = campaignStatuses[campaignId] === "PAUSED";
  const isTwilioError = softphone.status === "error" || softphone.status === "api_key_required";
  const isActive = phase !== "ready";

  function callLabel() {
    if (!campaignId) return "Choisir une campagne";
    if (isCampaignPaused) return "⏸ Campagne suspendue";
    if (isTwilioError) return "Twilio non configuré";
    if (selectedProspect) {
      const name = selectedProspect.contactName ?? selectedProspect.company ?? selectedProspect.phoneNumber;
      return `Appeler ${name} →`;
    }
    return "Appeler le prochain →";
  }

  return (
    <>
      {showWaveInfo && <WaveInfoModal onClose={() => setShowWaveInfo(false)} />}

      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3 pointer-events-none">

        {/* Floating panel */}
        {open && (
          <div
            className="pointer-events-auto w-80 rounded-2xl bg-white border border-gray-200 overflow-hidden"
            style={{
              boxShadow: "0 20px 60px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.08)",
              animation: "slide-up-sm 0.22s ease both",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${STATUS_DOT[softphone.status] ?? "bg-gray-400"}`} />
                <span className="text-sm font-semibold text-gray-900">Numéroteur</span>
                <button
                  onClick={() => setShowWaveInfo(true)}
                  title="Comment fonctionne le système à 3 vagues ?"
                  className="h-4 w-4 rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 flex items-center justify-center text-[10px] font-bold transition-colors"
                >
                  i
                </button>
              </div>
              <div className="flex items-center gap-2">
                {waveNumber && phase !== "ready" && (
                  <span className="rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-xs font-semibold text-red-700">
                    Vague {waveNumber}/3
                  </span>
                )}
                <span className="text-xs text-gray-400">{STATUS_LABEL[softphone.status] ?? softphone.status}</span>
                <button
                  onClick={toggleAutoMode}
                  title={autoMode ? "Désactiver le mode auto" : "Activer le mode auto"}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-all ${
                    autoMode
                      ? "bg-green-100 text-green-700 hover:bg-green-200"
                      : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${autoMode ? "bg-green-500 animate-pulse" : "bg-gray-300"}`} />
                  Auto
                </button>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {/* Campaign selector */}
              <select
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                disabled={phase !== "ready"}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 focus:border-red-400 focus:bg-white focus:outline-none disabled:opacity-60 transition-all"
              >
                <option value="">— Choisir une campagne —</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{campaignStatuses[c.id] === "PAUSED" ? " (suspendue)" : ""}
                  </option>
                ))}
              </select>

              {/* ── READY ── */}
              {phase === "ready" && (
                <div className="space-y-2">
                  {/* Prospect search */}
                  {campaignId && !isTwilioError && (
                    <ProspectSearch
                      campaignId={campaignId}
                      selected={selectedProspect}
                      onSelect={setSelectedProspect}
                    />
                  )}

                  <button
                    onClick={() => void callNext(selectedProspect?.id)}
                    disabled={!campaignId || softphone.status !== "ready" || isCampaignPaused || isTwilioError}
                    className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {callLabel()}
                  </button>

                  {campaignId && !isTwilioError && (
                    <button
                      onClick={() => void toggleCampaignPause()}
                      disabled={pauseLoading || !campaignId}
                      className={`w-full rounded-xl border px-3 py-2 text-xs font-medium transition-all duration-200 disabled:opacity-50 ${
                        isCampaignPaused
                          ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                          : "border-gray-200 text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      {pauseLoading ? "…" : isCampaignPaused ? "▶ Reprendre la campagne" : "⏸ Suspendre la campagne"}
                    </button>
                  )}

                  {nextWindow && nextWindowReason === "wave_done" && (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700 space-y-1">
                      <p className="font-semibold">✓ Vague terminée pour ce créneau</p>
                      <p>
                        Revenez à{" "}
                        <span className="font-semibold">
                          {new Date(nextWindow).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </span>{" "}
                        pour lancer la vague suivante dans un autre créneau.
                      </p>
                    </div>
                  )}
                  {nextWindow && nextWindowReason !== "wave_done" && (
                    <p className="text-xs text-center text-amber-600">
                      ◷ Hors plage — prochaine ouverture{" "}
                      {new Date(nextWindow).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}

                  {dialError && (
                    <p className="text-xs text-center text-red-600">{dialError}</p>
                  )}

                  {isTwilioError && (
                    <Link
                      href="/app/twilio"
                      className="block text-center text-xs text-red-600 underline underline-offset-2"
                    >
                      Configurer Twilio →
                    </Link>
                  )}
                </div>
              )}

              {/* ── DIALING ── */}
              {phase === "dialing" && (
                <div className="space-y-2">
                  <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 animate-spin text-red-500 shrink-0" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity=".2" />
                          <path d="M12 2a10 10 0 0 1 7.07 2.93" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                        <span className="text-sm font-medium text-gray-700">Composition…</span>
                      </div>
                      <span className="font-mono text-sm font-bold text-gray-500 tabular-nums">{fmt(dialSeconds)}</span>
                    </div>
                    {prospectInfo && (
                      <div className="border-t border-gray-200 pt-2 mt-1 space-y-0.5">
                        {(prospectInfo.contactName || prospectInfo.company) && (
                          <p className="text-sm font-semibold text-gray-800 truncate">
                            {prospectInfo.contactName ?? prospectInfo.company}
                          </p>
                        )}
                        {prospectInfo.contactName && prospectInfo.company && (
                          <p className="text-xs text-gray-500 truncate">{prospectInfo.company}</p>
                        )}
                        <p className="text-xs font-mono text-gray-500">{prospectInfo.phoneNumber}</p>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => void handleHangup()}
                    className="w-full rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
                  >
                    Raccrocher
                  </button>
                </div>
              )}

              {/* ── ALERTING ── */}
              {phase === "alerting" && (
                <div className="space-y-2">
                  <div className="rounded-xl bg-red-50 border-2 border-red-400 px-4 py-3 text-center">
                    <p className="text-xs font-bold text-red-600 uppercase tracking-widest">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse mr-1.5 -mb-0.5" />
                      Décroché humain !
                    </p>
                  </div>
                  <button
                    onClick={handleAccept}
                    className="w-full rounded-xl bg-green-500 py-3 text-base font-bold text-white hover:bg-green-600 active:scale-95 transition-all"
                  >
                    ✓ PARLER
                  </button>
                </div>
              )}

              {/* ── CALL ── */}
              {phase === "call" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-xl bg-green-50 border border-green-200 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-sm font-semibold text-green-800">En communication</span>
                    </div>
                    <span className="font-mono text-sm font-bold text-green-700 tabular-nums">{fmt(callSeconds)}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => void handleHangup()}
                      className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
                    >
                      Raccrocher
                    </button>
                    <Link
                      href="/app/session"
                      className="rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Fiche →
                    </Link>
                  </div>
                </div>
              )}

              {/* ── WRAP ── */}
              {phase === "wrap" && (
                <div className="space-y-2">
                  <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
                    <p className="text-sm font-semibold text-blue-800">Appel terminé</p>
                    <Link href="/app/session" className="text-xs text-blue-500 underline mt-0.5 block">
                      Voir la fiche et saisir la disposition →
                    </Link>
                  </div>
                  {autoMode && autoCountdown !== null ? (
                    <div className="flex gap-2">
                      <div className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-green-50 border border-green-200 py-2.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-sm font-medium text-green-700">
                          Prochain appel dans {autoCountdown}s…
                        </span>
                      </div>
                      <button
                        onClick={toggleAutoMode}
                        className="rounded-xl border border-red-200 px-3 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                      >
                        Pause
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => void handleNextAfterWrap()}
                      disabled={softphone.status !== "ready" || isCampaignPaused}
                      className="w-full rounded-xl bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
                    >
                      {isCampaignPaused ? "Campagne suspendue" : "Appel suivant →"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Toggle button */}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Fermer le numéroteur" : "Ouvrir le numéroteur"}
          className={`pointer-events-auto relative h-14 w-14 rounded-full flex items-center justify-center transition-all duration-300 ${
            phase === "alerting" && flashOn ? "scale-110" : ""
          }`}
          style={{
            background: "linear-gradient(145deg, #f87171, #dc2626 45%, #b91c1c)",
            boxShadow: open
              ? "0 8px 32px rgba(220,28,46,0.55), 0 0 0 4px rgba(255,255,255,0.15)"
              : "0 4px 22px rgba(220,28,46,0.42)",
            transform: open ? "scale(1.07)" : "scale(1)",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6.29 6.29l.98-.98a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>

          {isActive && !open && phase !== "alerting" && (
            <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-400" />
          )}
          {phase === "alerting" && !open && (
            <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-red-400 animate-pulse" />
          )}
          {autoMode && !isActive && !open && (
            <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500 animate-pulse" />
          )}
        </button>
      </div>
    </>
  );
}
