import type { Plan } from "@prisma/client";

export interface PlanConfig {
  label: string;
  monthlyCredits: number;
  humanAnsweredSurcharge: number;
  monthlyPriceCents: number;
  annualPriceCents: number;   // per-month equivalent when billed annually (-30%)
  color: "blue" | "red" | "purple";
  features: string[];
}

export const PLAN_CONFIG: Record<Plan, PlanConfig> = {
  ESSENTIEL: {
    label: "Starter",
    monthlyCredits: 500,
    humanAnsweredSurcharge: 6,
    monthlyPriceCents: 5900,   // 59 €/mois
    annualPriceCents: 4130,    // 59 × 0.70 = 41,30 €
    color: "blue",
    features: [
      "500 crédits / mois",
      "1 campagne active",
      "Import & export CSV",
      "Détection répondeur (AMD)",
      "Créneaux horaires configurables",
      "Support email",
    ],
  },
  PRO: {
    label: "Growth",
    monthlyCredits: 2000,
    humanAnsweredSurcharge: 4,
    monthlyPriceCents: 11900,  // 119 €/mois
    annualPriceCents: 8330,    // 119 × 0.70 = 83,30 €
    color: "red",
    features: [
      "2 000 crédits / mois",
      "Campagnes illimitées",
      "Analytics & heatmap",
      "Détection répondeur (AMD)",
      "Créneaux auto-optimisés",
      "Support prioritaire",
    ],
  },
  EXPERT: {
    label: "Scale",
    monthlyCredits: 5000,
    humanAnsweredSurcharge: 3,
    monthlyPriceCents: 22700,  // 227 €/mois
    annualPriceCents: 15890,   // 227 × 0.70 = 158,90 €
    color: "purple",
    features: [
      "5 000 crédits / mois",
      "Tout Growth inclus",
      "Accès API",
      "Bloctel automatique",
      "Account manager dédié",
      "SLA 99,9 %",
    ],
  },
};

export const PLAN_ORDER: Plan[] = ["ESSENTIEL", "PRO", "EXPERT"];

// Extra credit packs — 1 000 crédits = 75 €
export const ADDITIONAL_PACK_CREDITS = 1000;
export const ADDITIONAL_PACK_PRICE_CENTS = 7500;
