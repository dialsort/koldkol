"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const CRITERIA = [
  { id: "len", label: "8 caractères minimum", test: (p: string) => p.length >= 8 },
  { id: "upper", label: "Une majuscule", test: (p: string) => /[A-Z]/.test(p) },
  { id: "lower", label: "Une minuscule", test: (p: string) => /[a-z]/.test(p) },
  { id: "digit", label: "Un chiffre", test: (p: string) => /\d/.test(p) },
  { id: "special", label: "Un caractère spécial", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

function StrengthBar({ password }: { password: string }) {
  const passed = CRITERIA.filter((c) => c.test(password)).length;
  const pct = password.length === 0 ? 0 : passed / CRITERIA.length;
  const color =
    pct <= 0.4 ? "bg-red-500" : pct <= 0.6 ? "bg-orange-400" : pct <= 0.8 ? "bg-yellow-400" : "bg-green-500";

  if (password.length === 0) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="h-1 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <ul className="grid grid-cols-1 gap-0.5">
        {CRITERIA.map((c) => {
          const ok = c.test(password);
          return (
            <li key={c.id} className="flex items-center gap-1.5 text-xs">
              <span
                className={`shrink-0 flex items-center justify-center h-3.5 w-3.5 rounded-full transition-colors duration-200 ${
                  ok ? "bg-green-500" : "bg-gray-200"
                }`}
              >
                {ok ? (
                  <svg width="7" height="7" viewBox="0 0 7 7" fill="none" aria-hidden="true">
                    <path d="M1 3.5l1.8 1.8L6 1.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </span>
              <span className={ok ? "text-gray-500" : "text-gray-400"}>{c.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ accountName: "", email: "", password: "" });
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [touchedPassword, setTouchedPassword] = useState(false);

  const allCriteriaMet = useMemo(() => CRITERIA.every((c) => c.test(form.password)), [form.password]);
  const confirmMismatch = confirm.length > 0 && confirm !== form.password;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allCriteriaMet) {
      setError("Le mot de passe ne respecte pas les critères de sécurité.");
      return;
    }
    if (form.password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    setError("");

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountName: form.accountName, email: form.email, password: form.password }),
    });

    if (!res.ok) {
      try {
        const data = await res.json();
        setError(data.error ?? "Erreur lors de la création du compte");
      } catch {
        setError("Erreur lors de la création du compte");
      }
      setLoading(false);
      return;
    }

    router.push("/verify-email?sent=1&email=" + encodeURIComponent(form.email));
  }

  const inputClass = (key: string, invalid = false) =>
    `w-full rounded-xl border px-4 py-2.5 text-sm bg-white transition-all duration-200 outline-none ${
      invalid
        ? "border-red-400 shadow-[0_0_0_3px_rgba(220,28,46,0.08)]"
        : focused === key
          ? "border-red-400 shadow-[0_0_0_3px_rgba(220,28,46,0.08)]"
          : "border-gray-200 hover:border-gray-300"
    }`;

  return (
    <div className="min-h-screen flex bg-white">
      {/* ── Left brand panel ─────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[440px] shrink-0 bg-gradient-to-br from-red-600 to-rose-700 p-12 text-white relative overflow-hidden">
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

        <div className="relative flex items-center gap-3">
          <img src="/logo.png" alt="KoldKol" width={36} height={36} className="rounded-xl" />
          <span className="text-xl font-bold tracking-tight">KoldKol</span>
        </div>

        <div className="relative space-y-6">
          <p className="text-3xl font-bold leading-snug">
            Démarrez en
            <br />
            quelques minutes.
          </p>
          <div className="space-y-3">
            {[
              "Importez vos fichiers prospects CSV",
              "Connectez votre compte Twilio",
              "Lancez votre première session d'appels",
            ].map((step, i) => (
              <div key={step} className="flex items-start gap-3">
                <div className="shrink-0 h-5 w-5 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-[10px] font-bold mt-0.5">
                  {i + 1}
                </div>
                <span className="text-sm text-red-50">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-red-200">
          Données hébergées en France · CNIL conforme · AES-256
        </p>
      </div>

      {/* ── Right form panel ─────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50/60 overflow-y-auto">
        <div
          className="w-full max-w-sm py-6"
          style={{ animation: "slide-up-sm 0.5s cubic-bezier(0.16,1,0.3,1) both" }}
        >
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 flex items-center gap-2.5">
            <img src="/logo.png" alt="KoldKol" width={32} height={32} className="rounded-lg" />
            <span className="text-lg font-bold text-gray-900">KoldKol</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Créer votre compte</h1>
            <p className="mt-1.5 text-sm text-gray-500">
              Commencez gratuitement, sans carte bancaire.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Account name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Nom de l&apos;entreprise
              </label>
              <input
                type="text"
                value={form.accountName}
                onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                onFocus={() => setFocused("accountName")}
                onBlur={() => setFocused(null)}
                required
                minLength={2}
                placeholder="Acme SAS"
                className={inputClass("accountName")}
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email professionnel
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
                required
                placeholder="vous@acme.fr"
                className={inputClass("email")}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  onFocus={() => setFocused("password")}
                  onBlur={() => { setFocused(null); setTouchedPassword(true); }}
                  required
                  placeholder="Créez un mot de passe sécurisé"
                  className={inputClass("password", touchedPassword && !allCriteriaMet && form.password.length > 0) + " pr-10"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showPassword ? "Masquer" : "Afficher"}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              <StrengthBar password={form.password} />
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Confirmer le mot de passe
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onFocus={() => setFocused("confirm")}
                onBlur={() => setFocused(null)}
                required
                placeholder="Répétez votre mot de passe"
                className={inputClass("confirm", confirmMismatch)}
              />
              {confirmMismatch && (
                <p className="mt-1 text-xs text-red-500">Les mots de passe ne correspondent pas.</p>
              )}
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-red-500" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || confirmMismatch || (touchedPassword && !allCriteriaMet && form.password.length > 0)}
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
                  Création…
                </span>
              ) : (
                "Créer mon compte"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Déjà un compte ?{" "}
            <Link
              href="/login"
              className="text-red-600 font-medium hover:text-red-700 hover:underline underline-offset-2"
            >
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
