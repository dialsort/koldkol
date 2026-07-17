"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNewUser = searchParams.get("registered") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("Email ou mot de passe incorrect, ou email non vérifié.");
      setLoading(false);
      return;
    }

    router.push("/app");
  }

  return (
    <div className="min-h-screen flex bg-white">
      {/* ── Left brand panel ─────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[440px] shrink-0 bg-gradient-to-br from-red-600 to-rose-700 p-12 text-white relative overflow-hidden">
        {/* Background decoration */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 80%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute -right-24 -top-24 w-64 h-64 rounded-full bg-white/5" />
        <div className="absolute -left-12 -bottom-12 w-48 h-48 rounded-full bg-white/5" />

        {/* Logo */}
        <div className="relative">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="KoldKol" width={36} height={36} className="rounded-xl" />
            <span className="text-xl font-bold tracking-tight">KoldKol</span>
          </div>
        </div>

        {/* Central content */}
        <div className="relative space-y-8">
          <div>
            <p className="text-3xl font-bold leading-snug">
              Triez vos prospects.
              <br />
              Appelez les bons.
            </p>
            <p className="mt-3 text-sm text-red-100 leading-relaxed">
              Identifiez automatiquement les contacts joignables par créneau horaire grâce à l'IA de
              scoring de joignabilité.
            </p>
          </div>

          <div className="space-y-4">
            {[
              { icon: "◎", label: "Scoring par créneau en temps réel" },
              { icon: "⊕", label: "File de rappel priorisée automatiquement" },
              { icon: "◈", label: "Conformité CNIL & RGPD intégrée" },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-red-200 text-lg">{icon}</span>
                <span className="text-sm text-red-50">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative">
          <p className="text-xs text-red-200">Données hébergées en France · Chiffrement AES-256</p>
        </div>
      </div>

      {/* ── Right form panel ─────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50/60">
        <div
          className="w-full max-w-sm"
          style={{ animation: "slide-up-sm 0.5s cubic-bezier(0.16,1,0.3,1) both" }}
        >
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 flex items-center gap-2.5">
            <img src="/logo.png" alt="KoldKol" width={32} height={32} className="rounded-lg" />
            <span className="text-lg font-bold text-gray-900">KoldKol</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">
              {isNewUser ? "Bienvenue !" : "Connexion"}
            </h1>
            <p className="mt-1.5 text-sm text-gray-500">
              {isNewUser
                ? "Votre compte est créé. Connectez-vous pour commencer."
                : "Accédez à votre espace de travail."}
            </p>
          </div>

          {isNewUser && (
            <div className="mb-5 rounded-xl bg-green-50 border border-green-200 p-3.5 text-sm text-green-700 flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>Compte créé avec succès. Configurez Twilio après la connexion.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              {
                id: "email",
                label: "Email",
                type: "email",
                value: email,
                onChange: (v: string) => setEmail(v),
                placeholder: "vous@entreprise.com",
              },
              {
                id: "password",
                label: "Mot de passe",
                type: "password",
                value: password,
                onChange: (v: string) => setPassword(v),
                placeholder: "••••••••",
              },
            ].map(({ id, label, type, value, onChange, placeholder }) => (
              <div key={id}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
                <input
                  id={id}
                  type={type}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  onFocus={() => setFocused(id)}
                  onBlur={() => setFocused(null)}
                  required
                  placeholder={placeholder}
                  className={`w-full rounded-xl border px-4 py-2.5 text-sm bg-white transition-all duration-200 outline-none ${
                    focused === id
                      ? "border-red-400 shadow-[0_0_0_3px_rgba(220,28,46,0.08)]"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                />
              </div>
            ))}

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-red-500" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-red w-full py-2.5 text-sm font-semibold mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="dialer-spinner h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"
                      strokeLinecap="round"
                    />
                  </svg>
                  Connexion…
                </span>
              ) : (
                "Se connecter"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Pas encore de compte ?{" "}
            <Link
              href="/signup"
              className="text-red-600 font-medium hover:text-red-700 hover:underline underline-offset-2"
            >
              Créer un compte
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
