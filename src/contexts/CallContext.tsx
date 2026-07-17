"use client";

import { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";
import { useSoftphone } from "@/hooks/useSoftphone";
import { useAudioAlert } from "@/hooks/useAudioAlert";

export type Phase = "ready" | "dialing" | "alerting" | "call" | "wrap";

export interface Campaign {
  id: string;
  name: string;
  status: string;
}

export interface ProspectInfo {
  company: string | null;
  contactName: string | null;
  phoneNumber: string;
}

export interface CallContextValue {
  softphone: ReturnType<typeof useSoftphone>;
  audio: ReturnType<typeof useAudioAlert>;
  campaigns: Campaign[];
  campaignId: string;
  setCampaignId: (id: string) => void;
  phase: Phase;
  callAttemptId: string | null;
  prospectId: string | null;
  prospectInfo: ProspectInfo | null;
  dialError: string | null;
  flashOn: boolean;
  callSeconds: number;
  dialSeconds: number;
  nextWindow: string | null;
  nextWindowReason: "legal_hours" | "no_prospects" | "wave_done" | null;
  pauseLoading: boolean;
  campaignStatuses: Record<string, string>;
  setCampaignStatuses: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  autoMode: boolean;
  autoCountdown: number | null;
  waveNumber: number | null;
  toggleAutoMode: () => void;
  callNext: (prospectId?: string) => Promise<void>;
  handleAccept: () => void;
  handleHangup: () => Promise<void>;
  handleNextAfterWrap: () => void;
  toggleCampaignPause: () => Promise<void>;
}

const CallContext = createContext<CallContextValue | null>(null);

export function useCallContext() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCallContext must be used within CallProvider");
  return ctx;
}

const AUTO_DELAY_SEC = 3;

export function CallProvider({
  children,
  initialCampaigns,
}: {
  children: React.ReactNode;
  initialCampaigns: Campaign[];
}) {
  const softphone = useSoftphone();
  const audio = useAudioAlert();

  const [campaigns] = useState<Campaign[]>(initialCampaigns);
  const [campaignId, setCampaignId] = useState(initialCampaigns[0]?.id ?? "");
  const [phase, setPhase] = useState<Phase>("ready");
  const [callAttemptId, setCallAttemptId] = useState<string | null>(null);
  const [prospectId, setProspectId] = useState<string | null>(null);
  const [dialError, setDialError] = useState<string | null>(null);
  const [flashOn, setFlashOn] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [dialSeconds, setDialSeconds] = useState(0);
  const [prospectInfo, setProspectInfo] = useState<ProspectInfo | null>(null);
  const [nextWindow, setNextWindow] = useState<string | null>(null);
  const [nextWindowReason, setNextWindowReason] = useState<"legal_hours" | "no_prospects" | "wave_done" | null>(null);
  const [waveNumber, setWaveNumber] = useState<number | null>(null);
  const [pauseLoading, setPauseLoading] = useState(false);
  const [campaignStatuses, setCampaignStatuses] = useState<Record<string, string>>(
    () => Object.fromEntries(initialCampaigns.map((c) => [c.id, c.status]))
  );
  const [autoMode, setAutoMode] = useState(false);
  const [autoCountdown, setAutoCountdown] = useState<number | null>(null);

  const phaseRef = useRef(phase);
  const autoModeRef = useRef(autoMode);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dialTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoFireRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callNextRef = useRef<((id?: string) => Promise<void>) | null>(null);
  const audioUnlocked = useRef(false);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { autoModeRef.current = autoMode; }, [autoMode]);

  // Fetch prospect info when prospectId is set
  useEffect(() => {
    if (!prospectId) { setProspectInfo(null); return; }
    fetch(`/api/prospects/${prospectId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: { prospect: ProspectInfo } | null) => {
        if (data?.prospect) setProspectInfo(data.prospect);
      })
      .catch(() => null);
  }, [prospectId]);

  // Dial timer + ringing during dialing phase
  useEffect(() => {
    if (phase === "dialing") {
      setDialSeconds(0);
      audio.startRinging();
      dialTimerRef.current = setInterval(() => setDialSeconds((s) => s + 1), 1000);
    } else {
      audio.stopRinging();
      if (dialTimerRef.current) { clearInterval(dialTimerRef.current); dialTimerRef.current = null; }
    }
    return () => {
      if (dialTimerRef.current) { clearInterval(dialTimerRef.current); dialTimerRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Mode auto : quand on arrive en "wrap", décompte puis appel suivant
  useEffect(() => {
    const clearAuto = () => {
      if (autoCountdownRef.current) { clearInterval(autoCountdownRef.current); autoCountdownRef.current = null; }
      if (autoFireRef.current) { clearTimeout(autoFireRef.current); autoFireRef.current = null; }
      setAutoCountdown(null);
    };

    if (phase === "wrap" && autoMode) {
      setAutoCountdown(AUTO_DELAY_SEC);
      let remaining = AUTO_DELAY_SEC;

      autoCountdownRef.current = setInterval(() => {
        remaining -= 1;
        setAutoCountdown(remaining);
        if (remaining <= 0) {
          if (autoCountdownRef.current) { clearInterval(autoCountdownRef.current); autoCountdownRef.current = null; }
        }
      }, 1000);

      autoFireRef.current = setTimeout(() => {
        setAutoCountdown(null);
        if (autoModeRef.current && callNextRef.current) {
          void callNextRef.current();
        }
      }, AUTO_DELAY_SEC * 1000);
    } else {
      clearAuto();
    }

    return clearAuto;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, autoMode]);

  // Softphone → phase transitions
  useEffect(() => {
    if (softphone.status === "ringing" && phaseRef.current === "dialing") {
      setPhase("alerting");
      audio.startAlert();
      const iv = setInterval(() => setFlashOn((v) => !v), 450);
      return () => clearInterval(iv);
    }
    if (softphone.status === "connected" && phaseRef.current === "alerting") {
      setPhase("call");
      audio.stopAlert();
      setFlashOn(false);
      setCallSeconds(0);
    }
    if (softphone.status === "ready" && phaseRef.current === "call") {
      setPhase("wrap");
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [softphone.status, audio]);

  // Call timer
  useEffect(() => {
    if (phase === "call") {
      timerRef.current = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  // Poll attempt result during dialing — stops when result arrives or after 90s timeout
  useEffect(() => {
    if (phase !== "dialing" || !callAttemptId) {
      if (pollRef.current) clearInterval(pollRef.current);
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
      return;
    }

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/call-attempts/${callAttemptId}`);
        if (!res.ok) return;
        const data = (await res.json()) as { result: string | null };
        if (data.result !== null && phaseRef.current === "dialing") {
          clearInterval(pollRef.current!);
          clearTimeout(pollTimeoutRef.current!);
          setPhase("wrap");
        }
      } catch { /* non-blocking */ }
    }, 2500);

    pollTimeoutRef.current = setTimeout(() => {
      if (phaseRef.current === "dialing") {
        clearInterval(pollRef.current!);
        setPhase("wrap");
      }
    }, 90_000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, [phase, callAttemptId]);

  function ensureAudio() {
    if (!audioUnlocked.current) {
      audio.unlockAudio();
      audioUnlocked.current = true;
    }
  }

  const isCampaignPaused = campaignStatuses[campaignId] === "PAUSED";
  const isTwilioError = softphone.status === "error" || softphone.status === "api_key_required";

  const callNext = useCallback(async (overrideProspectId?: string) => {
    if (!campaignId || softphone.status !== "ready" || isCampaignPaused || isTwilioError) return;
    ensureAudio();
    setDialError(null);
    setNextWindow(null);
    setNextWindowReason(null);
    setWaveNumber(null);
    setProspectId(null);
    setProspectInfo(null);
    setCallAttemptId(null);
    setDialSeconds(0);
    setPhase("dialing");

    try {
      const res = await fetch(`/api/dialer/${campaignId}/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(overrideProspectId ? { prospectId: overrideProspectId } : {}),
      });
      const data = (await res.json()) as {
        kind?: string;
        callAttemptId?: string;
        prospectId?: string;
        nextWindow?: string;
        reason?: "legal_hours" | "no_prospects" | "wave_done";
        waveNumber?: number;
        error?: string;
      };

      if (data.kind === "outside_window") {
        setNextWindow(data.nextWindow ?? null);
        setNextWindowReason(data.reason ?? null);
        setPhase("ready");
        return;
      }
      if (data.error === "CAMPAIGN_NOT_ACTIVE") {
        setCampaignStatuses((prev) => ({ ...prev, [campaignId]: "PAUSED" }));
        setPhase("ready");
        return;
      }
      if (!res.ok || data.error) {
        setDialError(data.error ?? "Erreur lors de la composition");
        setPhase("ready");
        return;
      }

      setCallAttemptId(data.callAttemptId ?? null);
      if (data.prospectId) setProspectId(data.prospectId);
      if (data.waveNumber) setWaveNumber(data.waveNumber);
    } catch {
      setDialError("Erreur réseau");
      setPhase("ready");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, softphone.status, isCampaignPaused, isTwilioError]);

  // Toujours à jour pour le timer auto (évite les closures périmées)
  useEffect(() => { callNextRef.current = callNext; }, [callNext]);

  const toggleAutoMode = useCallback(() => {
    setAutoMode((v) => !v);
  }, []);

  const handleAccept = useCallback(() => {
    ensureAudio();
    softphone.accept();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [softphone]);

  const handleHangup = useCallback(async () => {
    if (phaseRef.current === "dialing" && callAttemptId && campaignId) {
      try {
        await fetch(`/api/dialer/${campaignId}/hangup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callAttemptId }),
        });
      } catch { /* non-blocking */ }
      audio.stopRinging();
      setPhase("wrap");
    } else {
      softphone.hangup();
      audio.stopAlert();
      setFlashOn(false);
    }
  }, [softphone, audio, callAttemptId, campaignId]);

  const handleNextAfterWrap = useCallback(() => {
    setPhase("ready");
    setCallAttemptId(null);
    setProspectId(null);
    setProspectInfo(null);
  }, []);

  const toggleCampaignPause = useCallback(async () => {
    if (!campaignId || phase !== "ready") return;
    const nextStatus = isCampaignPaused ? "ACTIVE" : "PAUSED";
    setPauseLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) setCampaignStatuses((prev) => ({ ...prev, [campaignId]: nextStatus }));
    } catch { /* non-blocking */ }
    finally { setPauseLoading(false); }
  }, [campaignId, phase, isCampaignPaused]);

  return (
    <CallContext.Provider
      value={{
        softphone, audio, campaigns, campaignId, setCampaignId,
        phase, callAttemptId, prospectId, prospectInfo, dialError, flashOn,
        callSeconds, dialSeconds, nextWindow, nextWindowReason, pauseLoading, campaignStatuses,
        setCampaignStatuses, autoMode, autoCountdown, waveNumber, toggleAutoMode,
        callNext, handleAccept, handleHangup, handleNextAfterWrap, toggleCampaignPause,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}
