"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Device, Call } from "@twilio/voice-sdk";

export type SoftphoneStatus =
  | "idle"
  | "registering"
  | "ready"
  | "ringing"
  | "connected"
  | "error"
  | "api_key_required";

export interface SoftphoneState {
  status: SoftphoneStatus;
  errorMessage: string | null;
  activeCall: Call | null;
  accept: () => void;
  hangup: () => void;
  reinitialise: () => void;
}

// Twilio error codes we handle specifically
const CODE_INVALID_TOKEN = 20101; // API Key not recognised by Twilio
const CODE_EXPIRED_TOKEN = 20104; // Token TTL elapsed → auto-refresh

async function fetchToken(): Promise<string> {
  const res = await fetch("/api/voice-token");
  if (!res.ok) {
    const body = (await res.json()) as { error?: string };
    throw Object.assign(new Error(body.error ?? `HTTP ${res.status}`), {
      apiError: body.error,
    });
  }
  const { token } = (await res.json()) as { token: string };
  return token;
}

export function useSoftphone(): SoftphoneState {
  const deviceRef = useRef<Device | null>(null);
  const pendingCallRef = useRef<Call | null>(null);
  const [status, setStatus] = useState<SoftphoneStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);

  const initialise = useCallback(async () => {
    setStatus("registering");
    setErrorMessage(null);

    const { Device: TwilioDevice } = await import("@twilio/voice-sdk");

    if (deviceRef.current) {
      deviceRef.current.destroy();
      deviceRef.current = null;
    }

    let token: string;
    try {
      token = await fetchToken();
    } catch (err) {
      const e = err as Error & { apiError?: string };
      if (e.apiError === "API_KEY_REQUIRED") {
        setStatus("api_key_required");
        setErrorMessage("Reconfigurez Twilio avec vos identifiants pour activer le softphone.");
        return;
      }
      setStatus("error");
      setErrorMessage(e.message ?? "Impossible de récupérer le token Twilio.");
      return;
    }

    // "silent" prevents the SDK from calling console.error internally.
    // All error handling is done via the "error" event below.
    const device = new TwilioDevice(token, { logLevel: "silent" });

    device.on("registered", () => setStatus("ready"));

    device.on("error", async (err: Error & { code?: number }) => {
      const code = err.code ?? 0;

      if (code === CODE_EXPIRED_TOKEN) {
        // Token TTL elapsed — transparently fetch a new one and re-register
        try {
          const fresh = await fetchToken();
          device.updateToken(fresh);
          // updateToken triggers re-registration; "registered" event will fire again
          return;
        } catch {
          setStatus("error");
          setErrorMessage("Impossible de renouveler le token Twilio.");
          return;
        }
      }

      if (code === CODE_INVALID_TOKEN) {
        setStatus("error");
        setErrorMessage(
          "Clé API Twilio invalide (20101). Allez dans Twilio → reconfigurez vos identifiants."
        );
        return;
      }

      setStatus("error");
      setErrorMessage(err.message ?? "Erreur Twilio inconnue.");
    });

    device.on("incoming", (call: Call) => {
      pendingCallRef.current = call;
      setStatus("ringing");

      call.on("accept", () => {
        setActiveCall(call);
        setStatus("connected");
      });
      call.on("disconnect", () => {
        pendingCallRef.current = null;
        setActiveCall(null);
        setStatus("ready");
      });
      call.on("cancel", () => {
        pendingCallRef.current = null;
        setStatus("ready");
      });
    });

    // Proactive refresh 5 minutes before expiry
    device.on("tokenWillExpire", () => {
      fetchToken()
        .then((fresh) => device.updateToken(fresh))
        .catch(() => {
          setStatus("error");
          setErrorMessage("Impossible de renouveler le token Twilio.");
        });
    });

    deviceRef.current = device;
    await device.register();
  }, []);

  useEffect(() => {
    initialise();
    return () => {
      deviceRef.current?.destroy();
      deviceRef.current = null;
    };
  }, [initialise]);

  const accept = useCallback(() => {
    pendingCallRef.current?.accept();
  }, []);

  const hangup = useCallback(() => {
    activeCall?.disconnect();
    pendingCallRef.current?.reject();
    pendingCallRef.current = null;
    setActiveCall(null);
    setStatus("ready");
  }, [activeCall]);

  return { status, errorMessage, activeCall, accept, hangup, reinitialise: initialise };
}
