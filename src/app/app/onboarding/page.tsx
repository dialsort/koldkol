"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveAndVerifyCredentials } from "@/app/app/twilio/actions";
import type { VerifyResult, CredentialInput } from "@/app/app/twilio/actions";
import Step6Import from "./Step6Import";

/* ─── Step definitions ─────────────────────────────────────────── */

const STEPS = [
  { id: 1, label: "Compte Twilio", short: "Compte", duration: "5 min" },
  { id: 2, label: "Compte production", short: "Production", duration: "2 min" },
  { id: 3, label: "Numéro français", short: "Numéro", duration: "5 min + délai" },
  { id: 4, label: "Vos identifiants", short: "Clés", duration: "1 min" },
  { id: 5, label: "Connecter à KoldKol", short: "Connexion", duration: "1 min" },
  { id: 6, label: "Importer vos prospects", short: "Contacts", duration: "2 min" },
];

/* ─── UI primitives ────────────────────────────────────────────── */

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-blue-50 border border-blue-100 px-4 py-3.5 text-sm text-blue-800">
      <svg className="shrink-0 mt-0.5 text-blue-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      <div>{children}</div>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3.5 text-sm text-amber-800">
      <svg className="shrink-0 mt-0.5 text-amber-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <div>{children}</div>
    </div>
  );
}

function ActionStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 items-start">
      <div className="shrink-0 h-6 w-6 rounded-full bg-gray-900 text-white text-[11px] font-black flex items-center justify-center mt-0.5">
        {n}
      </div>
      <div className="text-sm text-gray-700 leading-relaxed pt-0.5">{children}</div>
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code className="inline-block bg-gray-100 border border-gray-200 rounded-md px-1.5 py-0.5 text-[11px] font-mono text-gray-800 mx-0.5">
      {children}
    </code>
  );
}

function CostTable({ rows }: { rows: { label: string; value: string; note?: string }[] }) {
  return (
    <div className="rounded-2xl border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Estimation des coûts</p>
      </div>
      <div className="divide-y divide-gray-100">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-700">{r.label}</p>
              {r.note && <p className="text-xs text-gray-400 mt-0.5">{r.note}</p>}
            </div>
            <p className="text-sm font-bold text-gray-900 shrink-0 ml-4">{r.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Step 1–4 content ─────────────────────────────────────────── */

function Step1() {
  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <ActionStep n={1}>
          Rendez-vous sur{" "}
          <a href="https://www.twilio.com/try-twilio" target="_blank" rel="noopener noreferrer" className="text-red-600 font-semibold hover:underline">
            twilio.com/try-twilio
          </a>{" "}
          et cliquez sur <strong>"Start for free"</strong>.
        </ActionStep>
        <ActionStep n={2}>
          Renseignez votre prénom, nom, email professionnel et un mot de passe. Cliquez sur <strong>"Start your free trial"</strong>.
        </ActionStep>
        <ActionStep n={3}>
          Twilio vous envoie un email de vérification. Cliquez sur le lien dans l&apos;email.
        </ActionStep>
        <ActionStep n={4}>
          À l&apos;étape <strong>"Tell us about yourself"</strong> : choisissez <Mono>Voice Calling</Mono> comme fonctionnalité principale, et <Mono>With my own project</Mono> pour le cas d&apos;usage.
        </ActionStep>
        <ActionStep n={5}>
          Twilio vous demande un numéro de téléphone pour vérification SMS. Utilisez votre mobile professionnel.
        </ActionStep>
      </div>
      <Tip>
        Utilisez votre email professionnel (celui de votre entreprise, pas Gmail/Hotmail). Twilio fait confiance aux adresses email d&apos;entreprise pour l&apos;approbation des comptes business.
      </Tip>
      <CostTable rows={[
        { label: "Création du compte", value: "Gratuit", note: "15 $ de crédit offerts" },
        { label: "Compte trial", value: "Gratuit", note: "Limité aux numéros vérifiés" },
      ]} />
    </div>
  );
}

function Step2() {
  return (
    <div className="space-y-5">
      <Warning>
        Le compte trial <strong>ne peut appeler que des numéros vérifiés manuellement</strong>. Il est inutilisable pour KoldKol. Vous devez impérativement passer en compte production.
      </Warning>
      <div className="space-y-4">
        <ActionStep n={1}>
          Dans la console Twilio, repérez la bannière orange <Mono>Upgrade your account</Mono> en haut de page et cliquez dessus. Ou allez dans <Mono>Billing → Upgrade</Mono>.
        </ActionStep>
        <ActionStep n={2}>
          Entrez votre carte bancaire. Twilio ne prélève <strong>rien automatiquement</strong> — vous rechargez manuellement.
        </ActionStep>
        <ActionStep n={3}>
          Effectuez un premier rechargement de <strong>minimum 20 $</strong>. Ce crédit sera consommé au fur et à mesure de vos appels.
        </ActionStep>
        <ActionStep n={4}>
          À la question <em>"What are you building?"</em>, indiquez : <Mono>Outbound voice calls for sales prospecting</Mono>.
        </ActionStep>
      </div>
      <CostTable rows={[
        { label: "Upgrade compte", value: "Gratuit" },
        { label: "Rechargement minimum", value: "20 $", note: "Non remboursable, utilisé pour vos appels" },
        { label: "Coût estimé pour 1 000 appels FR", value: "~9 €", note: "500 sans réponse + 500 décrochés 3s + AMD" },
      ]} />
      <Tip>20 $ couvrent environ 2 000 appels de détection. Pour vos premiers tests, c&apos;est largement suffisant.</Tip>
    </div>
  );
}

function Step3() {
  return (
    <div className="space-y-5">
      <Warning>
        Les numéros français (+33) requièrent une vérification réglementaire imposée par l&apos;ARCEP. Ce processus peut prendre <strong>1 à 5 jours ouvrés</strong>. C&apos;est normal, prévoyez-le.
      </Warning>
      <p className="text-sm text-gray-600">
        Vous devez d&apos;abord créer un <strong>Regulatory Bundle</strong> (dossier de conformité), puis acheter le numéro.
      </p>
      <div className="space-y-4">
        <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Étape A — Créer le dossier réglementaire</p>
          <ActionStep n={1}>
            <Mono>Phone Numbers</Mono> → <Mono>Regulatory Compliance</Mono> → <Mono>Bundles</Mono> → <Mono>Create new Bundle</Mono>.
          </ActionStep>
          <ActionStep n={2}>
            Sélectionnez <Mono>Business</Mono>. Renseignez le nom légal de votre entreprise, votre adresse en France et votre SIRET.
          </ActionStep>
          <ActionStep n={3}>
            Uploadez un <strong>justificatif d&apos;adresse</strong> de moins de 3 mois (Kbis, relevé bancaire pro ou facture EDF).
          </ActionStep>
          <ActionStep n={4}>
            Soumettez le dossier. Statut initial : <Mono>Pending Review</Mono>. Twilio revient sous 1 à 5 jours.
          </ActionStep>
        </div>
        <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Étape B — Acheter le numéro (après validation)</p>
          <ActionStep n={1}>
            <Mono>Phone Numbers</Mono> → <Mono>Manage</Mono> → <Mono>Buy a number</Mono>.
          </ActionStep>
          <ActionStep n={2}>
            Filtrez sur <Mono>Country: France</Mono>. Choisissez un numéro <strong>Local</strong> (+33 1/2/3/4/5). Les mobiles (+33 6/7) sont très difficiles à obtenir.
          </ActionStep>
          <ActionStep n={3}>
            À l&apos;achat, liez votre Regulatory Bundle à ce numéro.
          </ActionStep>
        </div>
      </div>
      <Tip>Choisissez un numéro géographique de la région de vos prospects. Un numéro parisien (01) aura un meilleur taux de réponse qu&apos;un +33 9.</Tip>
      <CostTable rows={[
        { label: "Location numéro local FR", value: "~1,50 €/mois", note: "Facturé mensuellement" },
        { label: "Regulatory Bundle", value: "Gratuit" },
        { label: "Délai de validation", value: "1–5 jours", note: "Processus imposé par l'ARCEP" },
      ]} />
    </div>
  );
}

function Step4() {
  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600">
        Twilio utilise deux identifiants pour authentifier les appels API : l&apos;<strong>Account SID</strong> et une clé d&apos;authentification.
      </p>
      <div className="space-y-4">
        <ActionStep n={1}>
          Dans la console Twilio → <Mono>Account</Mono> → <Mono>General Settings</Mono>. Repérez le bloc <strong>"Account Info"</strong>.
        </ActionStep>
        <ActionStep n={2}>
          Copiez votre <strong>Account SID</strong> (commence par <Mono>AC</Mono>).
        </ActionStep>
        <ActionStep n={3}>
          Pour la clé : allez dans <Mono>Account</Mono> → <Mono>API keys &amp; tokens</Mono> → <Mono>Create API key</Mono>. Type <strong>Standard</strong>.
          Copiez immédiatement l&apos;<strong>API Key SID</strong> (SK…) et l&apos;<strong>API Secret</strong> — l&apos;API Secret ne s&apos;affiche qu&apos;une seule fois.
        </ActionStep>
        <ActionStep n={4}>
          Récupérez votre numéro : <Mono>Phone Numbers</Mono> → <Mono>Manage</Mono> → <Mono>Active Numbers</Mono>.
        </ActionStep>
      </div>
      <div className="rounded-2xl bg-gray-950 px-5 py-4 space-y-2.5 font-mono text-sm">
        <div className="flex items-center gap-3">
          <span className="text-gray-500 w-28 shrink-0 text-xs">Account SID</span>
          <span className="text-green-400 text-xs">ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-500 w-28 shrink-0 text-xs">API Key SID</span>
          <span className="text-blue-400 text-xs">SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-500 w-28 shrink-0 text-xs">API Secret</span>
          <span className="text-yellow-400 text-xs tracking-widest">••••••••••••••••••••••••</span>
          <span className="text-gray-600 text-[10px]">(une seule fois)</span>
        </div>
      </div>
      <Warning>
        L&apos;API Secret ne s&apos;affiche qu&apos;une seule fois à la création. Notez-le immédiatement. KoldKol le stocke de façon chiffrée (AES-256-GCM) — vous ne le reverrez jamais en clair.
      </Warning>
    </div>
  );
}

/* ─── Step 5 — credential form ─────────────────────────────────── */

function Step5Connect({ onSuccess }: { onSuccess: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [authMode, setAuthMode] = useState<"apikey" | "token">("apikey");
  const [form, setForm] = useState<Omit<CredentialInput, "authMode">>({
    accountSid: "",
    authToken: "",
    apiKey: "",
    apiSecret: "",
    phoneNumber: "",
  });
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await saveAndVerifyCredentials({ ...form, authMode });
      setResult(res);
      if (res.ok) {
        onSuccess();
      } else {
        setError(res.message);
      }
    });
  }

  if (result?.ok) {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 px-6 py-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-full bg-green-100 border border-green-200 flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-green-800 mb-1">Twilio connecté avec succès</p>
              <p className="text-sm text-green-700">
                Numéro vérifié : <code className="font-mono font-bold">{result.phoneNumber}</code>
              </p>
              <p className="text-sm text-green-600 mt-1">
                Vous pouvez maintenant importer vos prospects et lancer vos premières sessions d&apos;appels.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const inputClass = "w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm font-mono bg-white focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-100 transition-all";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-sm text-gray-600">
        Entrez vos identifiants Twilio — KoldKol les chiffre et les stocke en AES-256-GCM. La connexion est vérifiée en temps réel.
      </p>

      {/* Account SID */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          Account SID <span className="text-red-500">*</span>
        </label>
        <input value={form.accountSid} onChange={set("accountSid")} required placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" className={inputClass} />
      </div>

      {/* Auth mode toggle */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Mode d&apos;authentification</p>
        <div className="grid grid-cols-2 gap-2">
          {(["apikey", "token"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setAuthMode(mode)}
              className={`rounded-xl border px-4 py-2.5 text-sm text-left transition-all ${
                authMode === mode
                  ? "border-red-300 bg-red-50 text-red-700 font-semibold shadow-sm"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {mode === "apikey" ? (
                <span>API Key / Secret <span className="text-[10px] text-green-600 font-bold ml-1">Recommandé</span></span>
              ) : (
                "Auth Token"
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Credential fields */}
      {authMode === "apikey" ? (
        <>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              API Key SID <span className="text-red-500">*</span>
            </label>
            <input value={form.apiKey} onChange={set("apiKey")} required placeholder="SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              API Secret <span className="text-red-500">*</span>
            </label>
            <input type="password" value={form.apiSecret} onChange={set("apiSecret")} required placeholder="••••••••••••••••••••••••••••••••" className={inputClass} />
          </div>
        </>
      ) : (
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Auth Token <span className="text-red-500">*</span>
          </label>
          <input type="password" value={form.authToken} onChange={set("authToken")} required placeholder="••••••••••••••••••••••••••••••••" className={inputClass} />
        </div>
      )}

      {/* Phone number */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          Numéro Twilio <span className="text-red-500">*</span>
        </label>
        <input value={form.phoneNumber} onChange={set("phoneNumber")} required placeholder="+33612345678" className={inputClass} />
        <p className="text-[11px] text-gray-400 mt-1.5">Format E.164 — 12 caractères, ex. +33612345678</p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="btn-red w-full py-3 text-sm font-bold disabled:opacity-50"
      >
        {isPending ? "Vérification en cours…" : "Enregistrer et vérifier →"}
      </button>
    </form>
  );
}

/* ─── Main page ─────────────────────────────────────────────────── */

const CONTENT = [Step1, Step2, Step3, Step4];

export default function OnboardingPage() {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const [connected, setConnected] = useState(false);

  const step = STEPS[current];
  const isLast = current === STEPS.length - 1;
  const progress = ((current + 1) / STEPS.length) * 100;

  function goTo(i: number) {
    if (i <= current + 1) setCurrent(i);
  }

  function handleConnected() {
    setConnected(true);
  }

  const StepContent = current < 4 ? CONTENT[current] : null;
  const isTwilioStep = current === 4;
  const isImportStep = current === 5;

  return (
    <div className="max-w-2xl mx-auto space-y-8" style={{ animation: "slide-up-sm 0.45s cubic-bezier(0.16,1,0.3,1) both" }}>

      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-red-500 mb-1.5">
            Configuration initiale
          </p>
          <h1 className="text-2xl font-bold text-gray-900">Connectez Twilio</h1>
          <p className="mt-1 text-sm text-gray-400">
            Twilio est le service téléphonique qui permet à KoldKol de passer les appels.
          </p>
        </div>
        <Link href="/app" className="text-xs text-gray-400 hover:text-gray-600 transition-colors font-medium mt-1 shrink-0">
          Passer pour l&apos;instant →
        </Link>
      </div>

      {/* ── Step track ── */}
      <div className="space-y-3">
        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-600 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => {
            const done = i < current;
            const active = i === current;
            const reachable = i <= current + 1;
            return (
              <button
                key={s.id}
                onClick={() => reachable && goTo(i)}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 transition-all duration-200 ${
                  active
                    ? "bg-red-50 border border-red-200"
                    : done
                      ? "hover:bg-gray-50 border border-transparent"
                      : "border border-transparent opacity-40 cursor-default"
                }`}
                disabled={!reachable}
              >
                <div
                  className={`shrink-0 rounded-full flex items-center justify-center text-[9px] font-black transition-all ${
                    done ? "bg-green-500 text-white" : active ? "bg-red-600 text-white" : "bg-gray-200 text-gray-500"
                  }`}
                  style={{ width: 18, height: 18 }}
                >
                  {done ? (
                    <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                      <path d="M1.5 5l2.5 2.5L8.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : s.id}
                </div>
                <span className={`text-[11px] font-semibold hidden sm:block leading-none ${
                  active ? "text-red-700" : done ? "text-gray-500" : "text-gray-400"
                }`}>
                  {s.short}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content card ── */}
      <div
        className="rounded-3xl border border-gray-200 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden"
        key={current}
        style={{ animation: "slide-up-sm 0.3s cubic-bezier(0.16,1,0.3,1) both" }}
      >
        {/* Card header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 to-gray-800 px-7 py-6">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-red-600/15 blur-2xl" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-red-400 mb-1">
                Étape {step.id} / {STEPS.length}
              </p>
              <h2 className="text-lg font-bold text-white">{step.label}</h2>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-white/8 border border-white/10 px-3 py-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              <span className="text-[11px] text-white/40 font-medium">{step.duration}</span>
            </div>
          </div>
        </div>

        {/* Card body */}
        <div className="px-7 py-7">
          {StepContent ? (
            <StepContent />
          ) : isTwilioStep ? (
            <Step5Connect onSuccess={handleConnected} />
          ) : (
            <Step6Import />
          )}
        </div>

        {/* Card footer */}
        <div className="flex items-center justify-between px-7 py-5 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={() => goTo(current - 1)}
            disabled={current === 0}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 hover:border-gray-300 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Précédent
          </button>

          {/* Steps 1–4: next button */}
          {current < 4 && (
            <button
              onClick={() => goTo(current + 1)}
              className="flex items-center gap-2 rounded-xl bg-gray-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-gray-800 transition-colors shadow-sm"
            >
              Étape suivante
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}

          {/* Step 5 (Twilio): "next" only after connected */}
          {isTwilioStep && (
            connected ? (
              <button
                onClick={() => goTo(5)}
                className="flex items-center gap-2 rounded-xl bg-green-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-green-700 transition-colors shadow-sm"
              >
                Importer vos contacts
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            ) : (
              <span />
            )
          )}

          {/* Step 6 (Import, last): dashboard button */}
          {isImportStep && (
            <button
              onClick={() => router.push("/app")}
              className="btn-red flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-500/20"
            >
              Accéder au dashboard
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Help footer ── */}
      <div className="flex items-start gap-4 rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <div className="h-8 w-8 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-0.5">Besoin d&apos;aide ?</p>
          <p className="text-sm text-gray-400">
            Consultez la{" "}
            <a href="https://www.twilio.com/docs/usage/tutorials/how-to-use-your-free-trial-account" target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline font-medium">
              documentation Twilio
            </a>{" "}
            ou contactez-nous à{" "}
            <a href="mailto:support@koldkol.com" className="text-red-600 hover:underline font-medium">
              support@koldkol.com
            </a>.
          </p>
        </div>
      </div>
    </div>
  );
}
