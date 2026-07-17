"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Alert beeps — fired when a human picks up
const BEEP_PATTERN = [
  { freq: 880, dur: 0.1, delay: 0 },
  { freq: 1100, dur: 0.1, delay: 0.15 },
  { freq: 880, dur: 0.15, delay: 0.3 },
] as const;
const PATTERN_INTERVAL_MS = 1400;

// French phone ring — 440 Hz, ring-ring cadence (0.4s on / 0.2s off / 0.4s on / 1.5s off)
const RING_FREQ = 440;
const RING_CYCLE_MS = 2500;

export interface AudioAlertControls {
  unlockAudio: () => void;
  startAlert: () => void;
  stopAlert: () => void;
  startRinging: () => void;
  stopRinging: () => void;
  volume: number;
  setVolume: (v: number) => void;
  muted: boolean;
  setMuted: (m: boolean) => void;
}

export function useAudioAlert(): AudioAlertControls {
  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);

  const volumeRef = useRef(volume);
  const mutedRef = useRef(muted);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  const unlockAudio = useCallback(() => {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    if (ctxRef.current.state === "suspended") void ctxRef.current.resume();
  }, []);

  // ── Alert beeps (human picked up) ────────────────────────────────────────
  const playPattern = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || ctx.state !== "running" || mutedRef.current) return;
    const vol = volumeRef.current;
    BEEP_PATTERN.forEach(({ freq, dur, delay }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + delay;
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.start(t0);
      osc.stop(t0 + dur + 0.01);
    });
  }, []);

  const startAlert = useCallback(() => {
    if (intervalRef.current) return;
    playPattern();
    intervalRef.current = setInterval(playPattern, PATTERN_INTERVAL_MS);
  }, [playPattern]);

  const stopAlert = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  // ── Ring tone (prospect phone is ringing) ────────────────────────────────
  const playRingCycle = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || ctx.state !== "running" || mutedRef.current) return;
    const vol = volumeRef.current * 0.5;
    const now = ctx.currentTime;

    // First ring pulse: 0.4s
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1); gain1.connect(ctx.destination);
    osc1.frequency.value = RING_FREQ;
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(vol, now + 0.02);
    gain1.gain.setValueAtTime(vol, now + 0.38);
    gain1.gain.linearRampToValueAtTime(0, now + 0.4);
    osc1.start(now); osc1.stop(now + 0.41);

    // Second ring pulse: after 0.6s, lasts 0.4s
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2); gain2.connect(ctx.destination);
    osc2.frequency.value = RING_FREQ;
    gain2.gain.setValueAtTime(0, now + 0.6);
    gain2.gain.linearRampToValueAtTime(vol, now + 0.62);
    gain2.gain.setValueAtTime(vol, now + 0.98);
    gain2.gain.linearRampToValueAtTime(0, now + 1.0);
    osc2.start(now + 0.6); osc2.stop(now + 1.01);
  }, []);

  const startRinging = useCallback(() => {
    if (ringIntervalRef.current) return;
    playRingCycle();
    ringIntervalRef.current = setInterval(playRingCycle, RING_CYCLE_MS);
  }, [playRingCycle]);

  const stopRinging = useCallback(() => {
    if (ringIntervalRef.current) { clearInterval(ringIntervalRef.current); ringIntervalRef.current = null; }
  }, []);

  useEffect(() => {
    return () => {
      stopAlert();
      stopRinging();
      ctxRef.current?.close().catch(() => null);
    };
  }, [stopAlert, stopRinging]);

  return { unlockAudio, startAlert, stopAlert, startRinging, stopRinging, volume, setVolume, muted, setMuted };
}
