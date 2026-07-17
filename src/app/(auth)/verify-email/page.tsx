"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";

function VerifyEmailContent() {
  const params = useSearchParams();
  const router = useRouter();
  const sent = params.get("sent") === "1";
  const email = params.get("email") ?? "";
  const error = params.get("error");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleResend() {
    if (!email || resending) return;
    setResending(true);
    try {
      const res = await fetch("/api/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) setResent(true);
    } finally {
      setResending(false);
    }
  }

  if (error) {
    return (
      <div className="text-center space-y-4">
        <div className="h-16 w-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900">Lien invalide ou expiré</h1>
        <p className="text-sm text-gray-500 max-w-xs mx-auto">
          {error === "missing"
            ? "Aucun token de vérification fourni."
            : "Ce lien a déjà été utilisé ou a expiré (validité 24h)."}
        </p>
        <div className="flex flex-col gap-2 pt-2">
          {email && (
            <button
              onClick={handleResend}
              disabled={resending || resent}
              className="btn-red py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {resent ? "Email envoyé !" : resending ? "Envoi…" : "Renvoyer un email de vérification"}
            </button>
          )}
          <Link href="/signup" className="text-sm text-red-600 hover:underline font-medium">
            Créer un nouveau compte
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center space-y-5">
      {/* Animated envelope */}
      <div className="relative mx-auto h-20 w-20">
        <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-red-50 to-rose-100 border border-red-100 flex items-center justify-center">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="4" width="20" height="16" rx="3" />
            <path d="M2 7l10 7 10-7" />
          </svg>
        </div>
        {/* Pulsing dot */}
        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-green-400 border-2 border-white">
          <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75" />
        </span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Vérifiez votre email</h1>
        {sent && email ? (
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            On a envoyé un lien de confirmation à{" "}
            <span className="font-semibold text-gray-700">{email}</span>.
            <br />
            Cliquez dessus pour accéder directement à votre espace.
          </p>
        ) : (
          <p className="mt-2 text-sm text-gray-500">
            Un email de vérification vous a été envoyé.
          </p>
        )}
      </div>

      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700 text-left flex gap-2.5">
        <svg width="16" height="16" className="shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>Pensez à vérifier vos spams si vous ne voyez rien d&apos;ici 2 minutes.</span>
      </div>

      {resent ? (
        <p className="text-sm text-green-600 font-medium">Email renvoyé avec succès !</p>
      ) : (
        <button
          onClick={handleResend}
          disabled={resending || !email}
          className="text-sm text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {resending ? "Envoi en cours…" : "Vous n'avez rien reçu ? Renvoyer l'email"}
        </button>
      )}

      <button
        onClick={() => router.push("/login")}
        className="block w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors pt-1"
      >
        Retour à la connexion
      </button>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/60 p-6">
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-10"
        style={{ animation: "slide-up-sm 0.45s cubic-bezier(0.16,1,0.3,1) both" }}
      >
        <div className="mb-6 flex justify-center">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="KoldKol" width={32} height={32} className="rounded-lg" />
            <span className="text-lg font-bold text-gray-900">KoldKol</span>
          </div>
        </div>
        <Suspense>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}
