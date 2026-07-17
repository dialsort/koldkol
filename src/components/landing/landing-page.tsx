"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/* ─── Data ─────────────────────────────────────────────── */

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    monthly: 59,
    credits: 500,
    highlight: "Pour commencer",
    popular: false,
    dark: false,
    features: [
      "500 crédits / mois",
      "1 campagne active",
      "Import & export CSV",
      "Détection répondeur (AMD)",
      "Créneaux horaires configurables",
      "Support email",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    monthly: 119,
    credits: 2000,
    highlight: "Le plus populaire",
    popular: true,
    dark: false,
    features: [
      "2 000 crédits / mois",
      "Campagnes illimitées",
      "Analytics & heatmap",
      "Détection répondeur (AMD)",
      "Créneaux auto-optimisés",
      "Support prioritaire",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    monthly: 227,
    credits: 5000,
    highlight: "Pour les équipes",
    popular: false,
    dark: true,
    features: [
      "5 000 crédits / mois",
      "Tout Growth inclus",
      "Accès API",
      "Bloctel automatique",
      "Account manager dédié",
      "SLA 99,9 %",
    ],
  },
];

const STEPS = [
  {
    n: "01",
    icon: "📂",
    title: "Importez votre CSV",
    desc: "Glissez votre fichier. KoldKol détecte les colonnes, normalise les numéros en E.164 et vérifie Bloctel en automatique.",
  },
  {
    n: "02",
    icon: "📞",
    title: "KoldKol appelle",
    desc: "Dizaines d'appels en parallèle. Chaque appel dure 2–3 secondes : détecter si quelqu'un décroche, puis raccrocher.",
  },
  {
    n: "03",
    icon: "✅",
    title: "Récupérez la liste triée",
    desc: "Chaque contact est catégorisé : joignable, injoignable, faux numéro. Exportez et donnez aux commerciaux.",
  },
];

const FEATURES = [
  {
    icon: "⚡",
    title: "Appels en parallèle",
    desc: "Jusqu'à 50 appels simultanés avec rate limiting intelligent pour ne pas déclencher les filtres Twilio.",
  },
  {
    icon: "🤖",
    title: "Détection AMD",
    desc: "Answering Machine Detection de Twilio : on distingue un humain d'un répondeur avant de noter le statut.",
  },
  {
    icon: "🕐",
    title: "Créneaux intelligents",
    desc: "Appels à 9h, 11h, 14h, 17h, 19h par défaut. Personnalisables. Re-tentatives automatiques aux meilleurs horaires.",
  },
  {
    icon: "📊",
    title: "Analytics & heatmap",
    desc: "Visualisez les taux de réponse par heure et par jour de la semaine. Optimisez vos créneaux campagne après campagne.",
  },
  {
    icon: "⚖️",
    title: "Conforme Bloctel",
    desc: "Vérification automatique sur la liste d'opposition française avant chaque campagne. Zéro risque légal.",
  },
  {
    icon: "📤",
    title: "Export CSV enrichi",
    desc: "Statut, meilleure heure, nombre de tentatives : tout est dans le CSV prêt pour votre CRM.",
  },
];

/* ─── Helpers ───────────────────────────────────────────── */

function annualPrice(base: number) {
  return Math.round(base * 0.7);
}

function setShine(el: HTMLElement, e: React.MouseEvent) {
  const r = el.getBoundingClientRect();
  el.style.setProperty("--shine-x", `${((e.clientX - r.left) / r.width) * 100}%`);
  el.style.setProperty("--shine-y", `${((e.clientY - r.top) / r.height) * 100}%`);
}

/* ─── Dot Grid ──────────────────────────────────────────── */

function HeroDotGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    // — Tuning —
    const SPACING = 44; // grille plus aérée
    const BASE_R = 0.9; // point au repos très fin
    const MAX_R = 3.0; // grossissement discret au survol
    const RANGE = 260; // grande étendue d'influence
    const BREATHE = 0.28; // amplitude de la respiration
    const SPEED = 0.55; // vitesse de la respiration (rad/s)

    // Position cible de la souris et position lissée
    let tx = -9999,
      ty = -9999;
    let sx = -9999,
      sy = -9999; // smoothed
    let W = 0,
      H = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      W = canvas.width = rect.width;
      H = canvas.height = rect.height;
    };

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      tx = e.clientX - rect.left;
      ty = e.clientY - rect.top;
    };

    // Initialise la position lissée la première fois
    const onFirst = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      sx = e.clientX - rect.left;
      sy = e.clientY - rect.top;
      window.removeEventListener("mousemove", onFirst);
    };
    window.addEventListener("mousemove", onFirst, { once: true });

    let raf: number;
    const draw = (now: number) => {
      const t = now / 1000;

      // Lerp très doux : la tache "glisse" lentement vers la souris
      const LERP = 0.045;
      sx += (tx - sx) * LERP;
      sy += (ty - sy) * LERP;

      ctx.clearRect(0, 0, W, H);

      const cols = Math.ceil(W / SPACING) + 1;
      const rows = Math.ceil(H / SPACING) + 1;

      for (let i = 0; i <= cols; i++) {
        for (let j = 0; j <= rows; j++) {
          const x = i * SPACING - SPACING * 0.5;
          const y = j * SPACING - SPACING * 0.5;

          // Influence de la souris — plateau très large
          const d = Math.hypot(sx - x, sy - y);
          const raw = Math.max(0, 1 - d / RANGE);
          // Courbe cubic pour un tombé progressif
          const ease = raw * raw * (3 - 2 * raw);

          // Respiration : phase décalée par position → vague organique
          const phase = (i * 0.4 + j * 0.6) * 0.9;
          const breathe = 1 + BREATHE * Math.sin(t * SPEED + phase);

          const r = BASE_R * breathe + (MAX_R - BASE_R) * ease;
          const alpha = 0.055 * breathe + 0.38 * ease;

          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(220,28,46,${alpha.toFixed(3)})`;
          ctx.fill();
        }
      }

      raf = requestAnimationFrame(draw);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    window.addEventListener("mousemove", onMove, { passive: true });
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

/* ─── Component ─────────────────────────────────────────── */

export default function LandingPage() {
  const [annual, setAnnual] = useState(false);

  /* Scroll reveal */
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("in-view");
        }),
      { threshold: 0.12 }
    );
    document.querySelectorAll(".anim, .anim-left, .anim-scale").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  /* Navbar scroll shadow */
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const onScroll = () => {
      if (!navRef.current) return;
      navRef.current.classList.toggle("shadow-md", window.scrollY > 10);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="relative overflow-x-hidden bg-white text-gray-900 antialiased">
      {/* ── Navbar ──────────────────────────────────────── */}
      <nav
        ref={navRef}
        className="fixed top-0 z-50 w-full border-b border-transparent bg-white/75 backdrop-blur-xl transition-shadow duration-300"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 select-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="KoldKol" width={32} height={32} className="rounded-lg" />
            <span className="text-[20px] font-black tracking-tight">KoldKol</span>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-[13px] font-medium text-gray-500">
            <a href="#fonctionnement" className="hover:text-gray-900 transition-colors">
              Comment ça marche
            </a>
            <a href="#fonctionnalites" className="hover:text-gray-900 transition-colors">
              Fonctionnalités
            </a>
            <a href="#tarifs" className="hover:text-gray-900 transition-colors">
              Tarifs
            </a>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden sm:block rounded-full px-4 py-2 text-[13px] font-semibold text-gray-500 hover:text-gray-900 transition-colors"
            >
              Connexion
            </Link>
            <Link
              href="/signup"
              className="relative overflow-hidden rounded-full bg-red-600 px-5 py-2 text-[13px] font-bold text-white shadow-lg shadow-red-500/30 transition-all duration-300 hover:shadow-red-500/50 hover:-translate-y-px active:translate-y-0 group"
            >
              <span className="relative z-10">Démarrer gratuitement</span>
              <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-rose-500 to-red-600 bg-[length:200%] opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-[gradient-shift_3s_linear_infinite]" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden pt-24 pb-16 px-6">
        {/* Dot mosaic — réactif à la souris */}
        <HeroDotGrid />

        {/* Background mesh */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(220,28,46,0.06)_0%,transparent_60%)] pointer-events-none" />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(#dc1c2e 1px, transparent 1px), linear-gradient(90deg, #dc1c2e 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />

        {/* Floating orbs */}
        <div
          className="absolute top-[20%] left-[10%] h-72 w-72 rounded-full bg-red-400/6 blur-[80px] pointer-events-none"
          style={{ animation: "float-slow 12s ease-in-out infinite" }}
        />
        <div
          className="absolute top-[40%] right-[8%] h-56 w-56 rounded-full bg-rose-500/8 blur-[60px] pointer-events-none"
          style={{ animation: "float-slow 9s ease-in-out infinite 2s" }}
        />
        <div
          className="absolute bottom-[15%] left-[20%] h-48 w-48 rounded-full bg-red-300/6 blur-[70px] pointer-events-none"
          style={{ animation: "float 14s ease-in-out infinite 4s" }}
        />

        {/* Badge */}
        <div
          className="mb-7 flex items-center gap-2 rounded-full border border-red-100 bg-gradient-to-r from-red-50 to-rose-50 px-4 py-1.5 text-xs font-bold text-red-700"
          style={{ animation: "fade-in 0.8s ease 0.1s both" }}
        >
          <span className="relative flex h-2 w-2">
            <span
              className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"
              style={{ animation: "pulse-ring 1.5s ease-out infinite" }}
            />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
          </span>
          Identifiez automatiquement vos prospects joignables
        </div>

        {/* Headline */}
        <h1
          className="max-w-4xl text-center text-5xl font-black leading-[1.04] tracking-tight md:text-7xl"
          style={{ animation: "slide-up 0.9s cubic-bezier(0.16,1,0.3,1) 0.2s both" }}
        >
          Arrêtez d'appeler
          <br />
          <span className="gradient-text">des fantômes.</span>
        </h1>

        {/* Sub */}
        <p
          className="mt-7 max-w-xl text-center text-[17px] leading-relaxed text-gray-500"
          style={{ animation: "slide-up 0.9s cubic-bezier(0.16,1,0.3,1) 0.35s both" }}
        >
          KoldKol appelle automatiquement votre liste de prospects, détecte qui répond et à quelle
          heure — pour que vos commerciaux n'appellent que les bons contacts au bon moment.
        </p>

        {/* CTAs */}
        <div
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
          style={{ animation: "slide-up 0.9s cubic-bezier(0.16,1,0.3,1) 0.45s both" }}
        >
          <Link
            href="/signup"
            className="group relative overflow-hidden rounded-full bg-red-600 px-9 py-4 text-[15px] font-bold text-white shadow-2xl shadow-red-500/35 transition-all duration-300 hover:shadow-red-500/55 hover:-translate-y-0.5"
          >
            <span className="relative z-10">Essayer gratuitement →</span>
            {/* Shimmer pass on hover */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 overflow-hidden rounded-full">
              <div className="absolute inset-y-0 -left-full w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent group-hover:animate-[shimmer-pass_0.8s_ease_forwards]" />
            </div>
          </Link>
          <a
            href="#fonctionnement"
            className="rounded-full border border-gray-200 bg-white/80 backdrop-blur-sm px-9 py-4 text-[15px] font-semibold text-gray-700 shadow-sm transition-all duration-300 hover:border-gray-300 hover:bg-gray-50 hover:-translate-y-0.5"
          >
            Voir comment ça marche
          </a>
        </div>

        {/* Stats */}
        <div
          className="mt-16 flex flex-wrap items-center justify-center gap-12"
          style={{ animation: "slide-up 0.9s cubic-bezier(0.16,1,0.3,1) 0.55s both" }}
        >
          {[
            { v: "80%", l: "du temps récupéré" },
            { v: "3×", l: "plus de contacts joints" },
            { v: "< 5", l: "tentatives par contact" },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <div className="gradient-text text-4xl font-black tabular-nums">{s.v}</div>
              <div className="mt-1 text-[13px] text-gray-400 font-medium">{s.l}</div>
            </div>
          ))}
        </div>

        {/* Scroll cue */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40"
          style={{ animation: "fade-in 1s ease 1.2s both" }}
        >
          <div
            className="h-10 w-[1px] bg-gradient-to-b from-gray-400 to-transparent"
            style={{ animation: "float 2.5s ease-in-out infinite" }}
          />
        </div>
      </section>

      {/* ── Problem (dark) ──────────────────────────────── */}
      <section className="relative overflow-hidden bg-gray-950 py-32 px-6 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_110%,rgba(220,28,46,0.18),transparent)]" />
        {/* Light streaks */}
        <div className="absolute top-0 left-[30%] h-full w-px bg-gradient-to-b from-transparent via-red-500/15 to-transparent rotate-[8deg]" />
        <div className="absolute top-0 right-[25%] h-full w-px bg-gradient-to-b from-transparent via-white/5 to-transparent -rotate-[5deg]" />

        <div className="relative mx-auto max-w-5xl">
          <div className="anim text-center mb-16">
            <div className="gradient-text text-[90px] font-black leading-none md:text-[140px]">
              80%
            </div>
            <div className="mt-4 text-2xl font-bold text-white/90 md:text-4xl">
              des appels commerciaux
              <br className="hidden md:block" /> restent sans réponse
            </div>
          </div>

          <p className="anim delay-1 text-center text-lg text-gray-400 max-w-2xl mx-auto mb-16 leading-relaxed">
            Vos commerciaux passent 4 heures par jour à tomber sur des messageries, des numéros
            débranchés ou des prospects qui ne décrocheront jamais. KoldKol élimine ce bruit.
          </p>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                icon: "🕐",
                t: "Temps gaspillé",
                d: "4 h/jour par commercial en appels infructueux — soit 20 h/semaine de masse salariale évaporée.",
              },
              {
                icon: "💸",
                t: "Coût invisible",
                d: "Un commercial à 35k€ annuel : 40 % de son temps = 14 000 € jetés en appels sans réponse.",
              },
              {
                icon: "📉",
                t: "Moral en berne",
                d: "Taux d'épuisement 2× plus élevé quand les listes sont froides. Les meilleurs partent.",
              },
            ].map((item, i) => (
              <div
                key={item.t}
                className={`anim delay-${i + 2} card-shine rounded-2xl border border-white/8 bg-white/4 p-7 backdrop-blur-sm hover:bg-white/8 transition-colors duration-300`}
                style={{ "--shine-x": "50%", "--shine-y": "50%" } as React.CSSProperties}
                onMouseMove={(e) => setShine(e.currentTarget, e)}
              >
                <div className="text-3xl mb-4">{item.icon}</div>
                <div className="font-bold text-white text-lg mb-2">{item.t}</div>
                <div className="text-gray-400 text-sm leading-relaxed">{item.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────── */}
      <section id="fonctionnement" className="py-32 px-6 bg-gray-50">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <div className="anim inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-4 py-1.5 text-xs font-bold text-red-600 mb-5">
              COMMENT ÇA MARCHE
            </div>
            <h2 className="anim delay-1 text-4xl font-black tracking-tight md:text-5xl">
              3 étapes. C'est tout.
            </h2>
            <p className="anim delay-2 mt-4 text-gray-500 text-lg max-w-lg mx-auto">
              De la liste froide à la liste triée, sans effort manuel.
            </p>
          </div>

          <div className="relative grid md:grid-cols-3 gap-6">
            {/* Connector */}
            <div
              className="hidden md:block absolute top-[44px] left-[calc(16.66%+1rem)] right-[calc(16.66%+1rem)] h-px origin-left"
              style={{
                background: "linear-gradient(90deg, #fca5a5, #dc1c2e, #fca5a5)",
                animation: "line-grow 1.2s cubic-bezier(0.16,1,0.3,1) 0.6s both",
              }}
            />

            {STEPS.map((s, i) => (
              <div
                key={s.n}
                className={`anim delay-${i + 1} card-shine glow-border relative rounded-2xl border border-gray-200 bg-white p-8 shadow-sm group cursor-default`}
                style={{ "--shine-x": "50%", "--shine-y": "50%" } as React.CSSProperties}
                onMouseMove={(e) => setShine(e.currentTarget, e)}
              >
                <div className="mb-5 flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-xl shadow-lg shadow-red-500/30">
                    {s.icon}
                  </div>
                  <span className="text-xs font-black text-red-500 tracking-widest">
                    ÉTAPE {s.n}
                  </span>
                </div>
                <h3 className="text-[18px] font-black mb-3 group-hover:text-red-600 transition-colors duration-200">
                  {s.title}
                </h3>
                <p className="text-gray-500 text-[14px] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────── */}
      <section id="fonctionnalites" className="py-32 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <div className="anim inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-4 py-1.5 text-xs font-bold text-red-600 mb-5">
              FONCTIONNALITÉS
            </div>
            <h2 className="anim delay-1 text-4xl font-black tracking-tight md:text-5xl">
              Tout ce qu'il faut.
              <br />
              <span className="gradient-text">Rien de superflu.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className={`anim delay-${(i % 3) + 1} card-shine glow-border relative rounded-2xl border border-gray-100 bg-white p-7 group cursor-default`}
                style={{ "--shine-x": "50%", "--shine-y": "50%" } as React.CSSProperties}
                onMouseMove={(e) => setShine(e.currentTarget, e)}
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-red-50 to-rose-100 text-2xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                  {f.icon}
                </div>
                <h3 className="text-[16px] font-black mb-2 group-hover:text-red-600 transition-colors duration-200">
                  {f.title}
                </h3>
                <p className="text-gray-500 text-[13.5px] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────── */}
      <section id="tarifs" className="py-32 px-6 bg-gray-50 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(220,28,46,0.06),transparent)]" />

        <div className="relative mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <div className="anim inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-4 py-1.5 text-xs font-bold text-red-600 mb-5">
              TARIFS
            </div>
            <h2 className="anim delay-1 text-4xl font-black tracking-tight md:text-5xl mb-4">
              Payez à l'usage
            </h2>
            <p className="anim delay-2 text-gray-500 text-lg mb-9">
              1 crédit = 1 tentative d'appel. Rechargez quand vous voulez.
            </p>

            {/* Toggle */}
            <div className="anim delay-3 inline-flex items-center rounded-full bg-white border border-gray-200 p-1 shadow-sm">
              <button
                onClick={() => setAnnual(false)}
                className={`relative rounded-full px-6 py-2.5 text-[13px] font-semibold transition-all duration-300 ${
                  !annual ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Mensuel
              </button>
              <button
                onClick={() => setAnnual(true)}
                className={`relative rounded-full px-6 py-2.5 text-[13px] font-semibold transition-all duration-300 ${
                  annual ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Annuel
                <span
                  className={`ml-2 text-[11px] font-black transition-colors ${annual ? "text-green-400" : "text-green-600"}`}
                >
                  −30 %
                </span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 items-stretch">
            {PLANS.map((plan, i) => (
              /* Outer wrapper : pas d'overflow hidden → le badge peut déborder */
              <div
                key={plan.id}
                className={`anim delay-${i + 1} relative ${plan.popular ? "pt-5" : ""}`}
              >
                {/* Badge positionné sur le wrapper, PAS sur la card */}
                {plan.popular && (
                  <div className="absolute top-0 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-red-600 to-rose-500 px-5 py-1.5 text-[11px] font-black text-white shadow-lg shadow-red-500/40">
                    ⭐ LE PLUS POPULAIRE
                  </div>
                )}

                {/* Card avec overflow:hidden (shine) sans clipping du badge */}
                <div
                  className={`pricing-card card-shine relative flex flex-col h-full rounded-2xl border p-8 ${
                    plan.dark
                      ? "bg-gray-950 border-gray-800 text-white"
                      : plan.popular
                        ? "bg-white border-red-200 shadow-2xl shadow-red-500/12"
                        : "bg-white border-gray-200 shadow-sm"
                  }`}
                  style={{ "--shine-x": "50%", "--shine-y": "50%" } as React.CSSProperties}
                  onMouseMove={(e) => {
                    const el = e.currentTarget;
                    const r = el.getBoundingClientRect();
                    const x = (e.clientX - r.left) / r.width - 0.5;
                    const y = (e.clientY - r.top) / r.height - 0.5;
                    el.style.transform = `perspective(900px) rotateX(${-y * 7}deg) rotateY(${x * 7}deg) translateY(-6px) scale(1.01)`;
                    el.style.boxShadow = plan.popular
                      ? `0 30px 80px rgba(220,28,46,0.18), 0 0 0 1px rgba(220,28,46,0.3)`
                      : plan.dark
                        ? `0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)`
                        : `0 20px 60px rgba(0,0,0,0.1)`;
                    setShine(el, e);
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "";
                    e.currentTarget.style.boxShadow = "";
                  }}
                >
                  {/* Header */}
                  <div className="mb-6">
                    <div
                      className={`text-[12px] font-bold uppercase tracking-widest mb-1.5 ${plan.dark ? "text-red-400" : "text-red-600"}`}
                    >
                      {plan.highlight}
                    </div>
                    <div
                      className={`text-2xl font-black ${plan.dark ? "text-white" : "text-gray-900"}`}
                    >
                      {plan.name}
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-end gap-1.5 tabular-nums">
                      <span
                        className={`text-[52px] font-black leading-none transition-all duration-500 ${plan.dark ? "text-white" : "text-gray-900"}`}
                      >
                        {annual ? annualPrice(plan.monthly) : plan.monthly}€
                      </span>
                      <span
                        className={`mb-2.5 text-sm ${plan.dark ? "text-gray-400" : "text-gray-400"}`}
                      >
                        /mois
                      </span>
                    </div>
                    {annual ? (
                      <p
                        className={`text-[12px] mt-1.5 ${plan.dark ? "text-gray-500" : "text-gray-400"}`}
                      >
                        Soit {annualPrice(plan.monthly) * 12}€ facturés annuellement
                        <span className="ml-1.5 font-bold text-green-500">−30 %</span>
                      </p>
                    ) : (
                      <p
                        className={`text-[12px] mt-1.5 ${plan.dark ? "text-gray-600" : "text-gray-400"}`}
                      >
                        Ou <span className="font-semibold">{annualPrice(plan.monthly)}€/mois</span>{" "}
                        en annuel
                      </p>
                    )}
                  </div>

                  {/* Credits pill */}
                  <div
                    className={`rounded-xl px-4 py-3 mb-7 flex items-center justify-between ${plan.dark ? "bg-white/8" : "bg-gradient-to-r from-red-50 to-rose-50"}`}
                  >
                    <span
                      className={`text-[13px] font-medium ${plan.dark ? "text-gray-300" : "text-gray-600"}`}
                    >
                      Crédits / mois
                    </span>
                    <span
                      className={`text-2xl font-black ${plan.dark ? "text-white" : "text-red-600"}`}
                    >
                      {plan.credits.toLocaleString("fr-FR")}
                    </span>
                  </div>

                  {/* Features */}
                  <ul className="flex-1 space-y-3 mb-8">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className={`flex items-start gap-3 text-[13.5px] ${plan.dark ? "text-gray-300" : "text-gray-600"}`}
                      >
                        <span
                          className={`mt-0.5 flex-shrink-0 h-4.5 w-4.5 flex items-center justify-center rounded-full text-[10px] font-bold ${
                            plan.dark ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-600"
                          }`}
                        >
                          ✓
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Link
                    href="/signup"
                    className={`relative overflow-hidden block w-full rounded-full py-3.5 text-center text-[13px] font-bold transition-all duration-300 group ${
                      plan.dark
                        ? "bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-600/25"
                        : plan.popular
                          ? "bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-500/25"
                          : "bg-gray-100 text-gray-900 hover:bg-gray-200"
                    }`}
                  >
                    Commencer avec {plan.name} →
                    {(plan.popular || plan.dark) && (
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 overflow-hidden rounded-full">
                        <div className="absolute inset-y-0 -left-full w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-[shimmer-pass_0.7s_ease_forwards]" />
                      </div>
                    )}
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <p className="anim mt-9 text-center text-[13px] text-gray-400">
            Sans engagement · Résiliez à tout moment · Paiement sécurisé par Stripe
          </p>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────── */}
      <section className="relative overflow-hidden py-32 px-6">
        {/* Red gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-700 via-red-600 to-rose-600" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_30%_50%,rgba(255,255,255,0.12),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_80%_50%,rgba(0,0,0,0.15),transparent)]" />
        {/* Light streaks */}
        <div className="absolute top-0 left-[20%] h-full w-px bg-gradient-to-b from-transparent via-white/20 to-transparent rotate-[12deg]" />
        <div className="absolute top-0 left-[60%] h-full w-px bg-gradient-to-b from-transparent via-white/10 to-transparent -rotate-[7deg]" />
        <div className="absolute top-0 right-[15%] h-full w-px bg-gradient-to-b from-transparent via-white/15 to-transparent rotate-[4deg]" />
        {/* Glow orb */}
        <div
          className="absolute left-[15%] top-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-white/10 blur-[80px] pointer-events-none"
          style={{ animation: "float-slow 8s ease-in-out infinite" }}
        />

        <div className="relative mx-auto max-w-3xl text-center text-white anim">
          <div className="text-[13px] font-bold uppercase tracking-widest text-red-200 mb-5">
            Rejoignez KoldKol
          </div>
          <h2 className="text-4xl font-black leading-tight md:text-6xl mb-7">
            Vos commerciaux méritent
            <br />
            de meilleures listes.
          </h2>
          <p className="text-red-100 text-lg mb-10 max-w-lg mx-auto leading-relaxed">
            Arrêtez de payer vos équipes à laisser des messages vocaux. Donnez-leur uniquement les
            contacts qui répondent.
          </p>
          <Link
            href="/signup"
            className="group inline-flex items-center gap-3 rounded-full bg-white px-10 py-4 text-[15px] font-black text-red-600 shadow-2xl shadow-black/25 transition-all duration-300 hover:bg-red-50 hover:-translate-y-1 hover:shadow-black/35"
          >
            Démarrer gratuitement
            <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </Link>
          <p className="mt-5 text-[13px] text-red-200/70">Aucune carte requise · Accès immédiat</p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="border-t border-gray-100 bg-white py-14 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-10">
            <Link href="/" className="flex items-center gap-2 select-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="KoldKol" width={28} height={28} className="rounded-lg" />
              <span className="text-xl font-black">KoldKol</span>
            </Link>
            <div className="flex flex-wrap items-center gap-8 text-[13px] text-gray-500">
              <a href="#fonctionnement" className="hover:text-gray-900 transition-colors">
                Comment ça marche
              </a>
              <a href="#fonctionnalites" className="hover:text-gray-900 transition-colors">
                Fonctionnalités
              </a>
              <a href="#tarifs" className="hover:text-gray-900 transition-colors">
                Tarifs
              </a>
              <Link href="/login" className="hover:text-gray-900 transition-colors">
                Connexion
              </Link>
              <Link href="/signup" className="hover:text-gray-900 transition-colors">
                S'inscrire
              </Link>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-gray-100">
            <p className="text-[12px] text-gray-400">© 2026 KoldKol. Tous droits réservés.</p>
            <p className="text-[12px] text-gray-400">
              Conforme RGPD · Vérification Bloctel intégrée · Hébergé en Europe
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
