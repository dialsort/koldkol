import { stripe } from "./stripe";
import { PLAN_CONFIG, ADDITIONAL_PACK_CREDITS, ADDITIONAL_PACK_PRICE_CENTS } from "./plan-config";
import type { Plan, BillingCycle } from "@prisma/client";

// Stable lookup keys — never change these once prices exist in Stripe
const PRICE_LOOKUP_KEYS: Record<Plan, Record<BillingCycle, string>> = {
  ESSENTIEL: { MONTHLY: "kk_starter_monthly_v1", ANNUAL: "kk_starter_annual_v1" },
  PRO:       { MONTHLY: "kk_growth_monthly_v1",  ANNUAL: "kk_growth_annual_v1"  },
  EXPERT:    { MONTHLY: "kk_scale_monthly_v1",   ANNUAL: "kk_scale_annual_v1"   },
};
export const PACK_LOOKUP_KEY = "kk_extra_pack_1000_v1";

async function ensureProduct(plan: Plan): Promise<string> {
  const list = await stripe.products.list({ limit: 100, active: true });
  const existing = list.data.find((p) => p.metadata.kk_plan === plan);
  if (existing) return existing.id;
  const cfg = PLAN_CONFIG[plan];
  const product = await stripe.products.create({
    name: `KoldKol ${cfg.label}`,
    metadata: { kk_plan: plan },
  });
  return product.id;
}

export async function getPriceId(plan: Plan, cycle: BillingCycle): Promise<string> {
  const key = PRICE_LOOKUP_KEYS[plan][cycle];
  const existing = await stripe.prices.list({ lookup_keys: [key], limit: 1 });
  if (existing.data.length > 0) return existing.data[0].id;

  const cfg = PLAN_CONFIG[plan];
  const productId = await ensureProduct(plan);
  // Annual: charge the full year in one payment at the discounted per-month rate × 12
  const unitAmount =
    cycle === "ANNUAL" ? cfg.annualPriceCents * 12 : cfg.monthlyPriceCents;

  const price = await stripe.prices.create({
    product: productId,
    unit_amount: unitAmount,
    currency: "eur",
    recurring: { interval: cycle === "ANNUAL" ? "year" : "month" },
    lookup_key: key,
    transfer_lookup_key: true,
    metadata: { kk_plan: plan, kk_cycle: cycle },
  });
  return price.id;
}

export async function getPackPriceId(): Promise<string> {
  const existing = await stripe.prices.list({ lookup_keys: [PACK_LOOKUP_KEY], limit: 1 });
  if (existing.data.length > 0) return existing.data[0].id;

  const list = await stripe.products.list({ limit: 100, active: true });
  let productId = list.data.find((p) => p.metadata.kk_type === "extra_pack")?.id;
  if (!productId) {
    const product = await stripe.products.create({
      name: `KoldKol — Pack ${ADDITIONAL_PACK_CREDITS.toLocaleString("fr-FR")} crédits`,
      metadata: { kk_type: "extra_pack" },
    });
    productId = product.id;
  }

  const price = await stripe.prices.create({
    product: productId,
    unit_amount: ADDITIONAL_PACK_PRICE_CENTS,
    currency: "eur",
    lookup_key: PACK_LOOKUP_KEY,
    transfer_lookup_key: true,
    metadata: { kk_type: "extra_pack", kk_credits: String(ADDITIONAL_PACK_CREDITS) },
  });
  return price.id;
}
