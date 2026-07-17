"use client";

import { useState, useTransition } from "react";
import { saveAndVerifyCredentials, reverifyConnection } from "./actions";
import type { VerifyResult } from "./actions";
import type { TwilioStatus } from "@/types";

const STATUS_UI: Record<TwilioStatus, { label: string; icon: string; color: string }> = {
  CONNECTED: { label: "Connecté", icon: "✅", color: "text-green-700 bg-green-50 border-green-200" },
  INVALID_KEY: { label: "Clé invalide", icon: "❌", color: "text-red-700 bg-red-50 border-red-200" },
  QUOTA_EXCEEDED: { label: "Quota dépassé", icon: "⚠️", color: "text-orange-700 bg-orange-50 border-orange-200" },
  SUSPENDED: { label: "Compte suspendu", icon: "🚫", color: "text-red-700 bg-red-50 border-red-200" },
  DISCONNECTED: { label: "Non connecté", icon: "⚡", color: "text-gray-700 bg-gray-50 border-gray-200" },
};

function CredentialForm({ onSuccess }: { onSuccess: (r: VerifyResult) => void }) {
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({ accountSid: "", authToken: "", apiKey: "", apiSecret: "", phoneNumber: "", authMode: "token" as "apikey" | "token" });
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveAndVerifyCredentials(form);
      if (result.ok) onSuccess(result);
      else setError(result.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 text-xs text-blue-800 space-y-2">
        <p className="font-semibold text-blue-900 text-sm">Où trouver ces identifiants ?</p>
        <ol className="space-y-1 list-decimal list-inside text-blue-700">
          <li><strong>Account SID</strong> — console.twilio.com, colonne de gauche, commence par <code className="bg-blue-100 px-1 rounded">AC</code></li>
          <li><strong>Auth Token</strong> — juste en dessous du Account SID, cliquer sur l'icône œil pour le révéler</li>
          <li><strong>Numéro</strong> — console.twilio.com → Phone Numbers → Manage → Active numbers</li>
        </ol>
        <p className="text-blue-600">L'API Key pour le softphone est créée automatiquement.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Account SID <span className="text-red-500">*</span>
        </label>
        <input value={form.accountSid} onChange={set("accountSid")} required
          placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:border-red-400 focus:outline-none" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Auth Token <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input type={showToken ? "text" : "password"} value={form.authToken} onChange={set("authToken")} required
            placeholder="••••••••••••••••••••••••••••••••"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-16 text-sm font-mono focus:border-red-400 focus:outline-none" />
          <button type="button" onClick={() => setShowToken((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-700 px-2 py-1">
            {showToken ? "Cacher" : "Voir"}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Numéro Twilio <span className="text-red-500">*</span>
        </label>
        <input value={form.phoneNumber} onChange={set("phoneNumber")} required
          placeholder="+33612345678"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:border-red-400 focus:outline-none" />
        <p className="text-xs text-gray-400 mt-1">Format E.164 — ex. +33612345678</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <button type="submit" disabled={isPending}
        className="w-full rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
        {isPending ? "Connexion en cours…" : "Connecter Twilio"}
      </button>
    </form>
  );
}

function ResultPanel({ result, onEdit }: { result: VerifyResult; onEdit: () => void }) {
  const ui = STATUS_UI[result.status];
  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 flex items-start gap-3 ${ui.color}`}>
        <span className="text-xl">{ui.icon}</span>
        <div>
          <p className="font-semibold">{ui.label}</p>
          <p className="text-sm mt-0.5 opacity-80">{result.message}</p>
          {result.phoneNumber && <p className="text-sm mt-1 font-mono">{result.phoneNumber}</p>}
        </div>
      </div>
      <button onClick={onEdit} className="text-sm text-red-600 hover:underline">← Modifier les identifiants</button>
    </div>
  );
}

export default function TwilioWizard({ initialStatus }: { initialStatus?: TwilioStatus }) {
  const [showForm, setShowForm] = useState(initialStatus !== "CONNECTED");
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [isReverifying, startReverify] = useTransition();
  const [reverifyError, setReverifyError] = useState<string | null>(null);

  function handleSuccess(result: VerifyResult) {
    setVerifyResult(result);
    setShowForm(false);
  }

  function handleReverify() {
    setReverifyError(null);
    startReverify(async () => {
      const result = await reverifyConnection();
      setVerifyResult(result);
      if (!result.ok) setReverifyError(result.message);
    });
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
      <div className="border-b border-gray-100 px-6 py-4">
        <h2 className="font-semibold text-gray-900">
          {initialStatus === "CONNECTED" ? "Mettre à jour les identifiants" : "Connecter Twilio"}
        </h2>
        <p className="text-sm text-gray-400 mt-0.5">
          {initialStatus === "CONNECTED"
            ? "Enregistrez de nouveaux identifiants pour remplacer les actuels."
            : "Renseignez vos identifiants Twilio pour activer les appels."}
        </p>
      </div>

      <div className="p-6 space-y-6">
        {initialStatus && !showForm && !verifyResult && (
          <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-5 py-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Relancer la vérification</p>
              <p className="text-xs text-gray-400 mt-0.5">Vérifie les identifiants enregistrés sans les ressaisir.</p>
              {reverifyError && <p className="text-xs text-red-600 mt-1">{reverifyError}</p>}
            </div>
            <button onClick={handleReverify} disabled={isReverifying}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors">
              {isReverifying ? "Vérification…" : "Revérifier"}
            </button>
          </div>
        )}

        {verifyResult && !showForm && (
          <ResultPanel result={verifyResult} onEdit={() => { setVerifyResult(null); setShowForm(true); }} />
        )}

        {showForm && <CredentialForm onSuccess={handleSuccess} />}

        {initialStatus === "CONNECTED" && !showForm && !verifyResult && (
          <button onClick={() => setShowForm(true)} className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
            Modifier les identifiants →
          </button>
        )}
      </div>
    </div>
  );
}
