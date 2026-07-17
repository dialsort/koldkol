"use client";

import { useState, useEffect, useCallback } from "react";
import { useCallContext } from "@/contexts/CallContext";
import { ProspectCard } from "@/components/ProspectCard";
import Link from "next/link";
import type { ProspectCardData, CardDisposition, CardTag } from "@/components/ProspectCard";

const TWILIO_ERROR_MESSAGE: Record<string, string> = {
  INVALID_KEY: "Identifiants Twilio invalides (clé API révoquée ou incorrecte).",
  QUOTA_EXCEEDED: "Quota Twilio atteint. Vérifiez la facturation de votre compte Twilio.",
  TWILIO_UNAVAILABLE: "Service Twilio indisponible. Vérifiez votre configuration.",
  CALL_FAILED: "L'appel a échoué côté Twilio. Réessayez dans quelques instants.",
};

const STATUS_DOT: Record<string, string> = {
  idle: "bg-gray-300",
  registering: "bg-yellow-400 animate-pulse",
  ready: "bg-green-500",
  ringing: "bg-red-500 animate-pulse",
  connected: "bg-green-500",
  error: "bg-red-500",
  api_key_required: "bg-orange-400",
};

const STATUS_LABEL: Record<string, string> = {
  idle: "En attente",
  registering: "Enregistrement…",
  ready: "Prêt",
  ringing: "Sonnerie…",
  connected: "En communication",
  error: "Erreur",
  api_key_required: "Clé API requise",
};

interface ProspectPayload {
  prospect: ProspectCardData;
  allTags: CardTag[];
}

interface Props {
  initialCampaignId: string | null;
}

export default function SessionView({ initialCampaignId }: Props) {
  const {
    softphone, campaigns, campaignId, setCampaignId, phase,
    callAttemptId, prospectId, dialError, flashOn, callSeconds,
    nextWindow, pauseLoading, campaignStatuses, setCampaignStatuses,
    callNext, handleAccept, handleHangup, handleNextAfterWrap, toggleCampaignPause,
  } = useCallContext();

  const [prospectPayload, setProspectPayload] = useState<ProspectPayload | null>(null);
  const [dispositions, setDispositions] = useState<CardDisposition[]>([]);

  const isCampaignPaused = campaignStatuses[campaignId] === "PAUSED";
  const isTwilioError = softphone.status === "error" || softphone.status === "api_key_required";

  // Pre-select campaign from URL param
  useEffect(() => {
    if (initialCampaignId) setCampaignId(initialCampaignId);
  }, [initialCampaignId, setCampaignId]);

  // Load dispositions
  useEffect(() => {
    fetch("/api/dispositions")
      .then((r) => r.json())
      .then((d: CardDisposition[]) => setDispositions(d))
      .catch(() => null);
  }, []);

  // Load prospect when prospectId changes
  const loadProspect = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/prospects/${id}`);
      if (!res.ok) return;
      setProspectPayload((await res.json()) as ProspectPayload);
    } catch { /* non-blocking */ }
  }, []);

  useEffect(() => {
    if (prospectId) void loadProspect(prospectId);
    else setProspectPayload(null);
  }, [prospectId, loadProspect]);

  const dialErrorMessage = dialError
    ? (TWILIO_ERROR_MESSAGE[dialError] ?? `Erreur : ${dialError}`)
    : null;

  const fmtTimer = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const prospectName =
    prospectPayload?.prospect.company ??
    prospectPayload?.prospect.contactName ??
    prospectPayload?.prospect.phoneNumber;

  return (
    <div
      className={`rounded-2xl border transition-all duration-500 ${
        phase === "alerting"
          ? flashOn
            ? "border-red-400 shadow-[0_0_0_4px_rgba(220,28,46,0.2),0_0_60px_rgba(220,28,46,0.1)] bg-red-50/60"
            : "border-red-300 shadow-[0_0_0_2px_rgba(220,28,46,0.1)] bg-white"
          : "border-gray-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
      }`}
    >
      <div className="space-y-5 p-5">
        {/* ── Twilio error ─────────────────────────────────────────────── */}
        {isTwilioError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 flex items-start gap-3">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-500" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-800">
                {softphone.status === "api_key_required" ? "Configuration incomplète" : "Softphone hors ligne"}
              </p>
              <p className="text-xs text-red-500 mt-0.5">
                {softphone.status === "api_key_required"
                  ? "Auth Token seul ne supporte pas le softphone. Reconfigurez Twilio."
                  : (softphone.errorMessage ?? "Vérifiez votre configuration Twilio.")}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => softphone.reinitialise()}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
              >
                Reconnecter
              </button>
              <Link href="/app/twilio" className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors">
                Configurer →
              </Link>
            </div>
          </div>
        )}

        {/* ── Campaign paused ──────────────────────────────────────────── */}
        {isCampaignPaused && phase === "ready" && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-amber-400" />
              <p className="text-sm font-medium text-amber-800">Campagne suspendue</p>
            </div>
            <button
              onClick={() => void toggleCampaignPause()}
              disabled={pauseLoading}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              Reprendre
            </button>
          </div>
        )}

        {/* ── Campaign selector + status ───────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            disabled={phase !== "ready"}
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 focus:border-red-400 focus:bg-white focus:outline-none disabled:opacity-60 transition-all"
          >
            <option value="">— Choisir une campagne —</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{campaignStatuses[c.id] === "PAUSED" ? " (suspendue)" : ""}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-1.5">
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[softphone.status] ?? "bg-gray-300"}`} />
            <span className="text-xs font-medium text-gray-500">
              {STATUS_LABEL[softphone.status] ?? softphone.status}
            </span>
          </div>

          {campaignId && phase === "ready" && !isTwilioError && (
            <button
              onClick={() => void toggleCampaignPause()}
              disabled={pauseLoading}
              className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-all duration-200 disabled:opacity-50 ${
                isCampaignPaused
                  ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                  : "border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              {pauseLoading ? "…" : isCampaignPaused ? "▶ Reprendre" : "⏸ Suspendre"}
            </button>
          )}
        </div>

        {/* ══ ALERTING ══ */}
        {phase === "alerting" && (
          <div className="relative rounded-2xl border-2 border-red-400 bg-white p-8 text-center space-y-6 overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="absolute h-48 w-48 rounded-full border border-red-200 alert-ring opacity-50" />
              <div className="absolute h-48 w-48 rounded-full border border-red-100 alert-ring-slow opacity-30" />
            </div>
            <div className="relative space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-600 uppercase tracking-widest">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                Décroché humain !
              </div>
              {prospectName && <p className="text-lg font-bold text-gray-900">{prospectName}</p>}
              {prospectPayload?.prospect.phoneNumber && (
                <p className="font-mono text-sm text-gray-400">{prospectPayload.prospect.phoneNumber}</p>
              )}
            </div>
            <button
              onClick={handleAccept}
              className="relative inline-flex items-center gap-3 rounded-2xl bg-green-500 px-12 py-5 text-xl font-bold text-white shadow-lg hover:bg-green-600 active:scale-95 transition-all duration-150 z-10"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.6 3.41 2 2 0 0 1 3.57 1.25h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.79a16 16 0 0 0 6.29 6.29l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              PARLER
            </button>
          </div>
        )}

        {/* ══ DIALING ══ */}
        {phase === "dialing" && (
          <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-5 flex items-center gap-4">
            <svg className="h-10 w-10 animate-spin text-red-500 shrink-0" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="3" strokeOpacity=".15" />
              <path d="M20 4 a16 16 0 0 1 11.31 4.69" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-gray-800">Composition en cours…</p>
              {prospectName && <p className="text-xs text-gray-500 mt-0.5">{prospectName}</p>}
            </div>
          </div>
        )}

        {/* ══ CALL ══ */}
        {phase === "call" && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-green-500 pulse-dot" />
              <div>
                <p className="text-sm font-semibold text-green-800">En communication</p>
                {prospectName && <p className="text-xs text-green-600 mt-0.5">{prospectName}</p>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-bold text-green-700 tabular-nums">{fmtTimer(callSeconds)}</span>
              <button
                onClick={handleHangup}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors shadow-sm"
              >
                Raccrocher
              </button>
            </div>
          </div>
        )}

        {/* ══ WRAP ══ */}
        {phase === "wrap" && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3.5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-800">Appel terminé</p>
              <p className="text-xs text-blue-500 mt-0.5">Saisissez la disposition ci-dessous</p>
            </div>
            <button
              onClick={() => void handleNextAfterWrap()}
              disabled={softphone.status !== "ready" || isCampaignPaused}
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              {isCampaignPaused ? "Campagne suspendue" : "Appel suivant →"}
            </button>
          </div>
        )}

        {/* ══ READY ══ */}
        {phase === "ready" && (
          <div className="space-y-3">
            <button
              onClick={() => void callNext()}
              disabled={!campaignId || softphone.status !== "ready" || isCampaignPaused || isTwilioError}
              className="btn-red w-full sm:w-auto px-8 py-3 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
            >
              {!campaignId
                ? "Sélectionner une campagne"
                : isCampaignPaused
                  ? "⏸ Campagne suspendue"
                  : isTwilioError
                    ? "Twilio non configuré"
                    : "Appeler le prochain prospect →"}
            </button>

            {nextWindow && (
              <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5">
                <span className="text-amber-400">◷</span>
                Hors plage légale. Prochaine ouverture :{" "}
                <span className="font-semibold">
                  {new Date(nextWindow).toLocaleString("fr-FR", { weekday: "long", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            )}

            {dialErrorMessage && (
              <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-red-500 mt-1.5" />
                <div>
                  {dialErrorMessage}
                  {(dialError === "INVALID_KEY" || dialError === "QUOTA_EXCEEDED" || dialError === "TWILIO_UNAVAILABLE") && (
                    <Link href="/app/twilio" className="ml-1.5 text-red-600 underline underline-offset-2 text-xs">
                      Configurer →
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Prospect card ─────────────────────────────────────────────── */}
        {prospectPayload && (phase === "call" || phase === "wrap" || phase === "dialing") && (
          <div style={{ animation: "slide-up-sm 0.4s ease both" }}>
            <ProspectCard
              prospect={prospectPayload.prospect}
              allTags={prospectPayload.allTags}
              dispositions={dispositions}
              activeCallAttemptId={phase === "call" || phase === "wrap" ? (callAttemptId ?? undefined) : undefined}
              onRefresh={() => prospectId && void loadProspect(prospectId)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
