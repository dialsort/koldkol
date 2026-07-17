import Stripe from "stripe";

let _stripe: Stripe | undefined;

function getInstance(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
    _stripe = new Stripe(key, {
      apiVersion: "2026-06-24.dahlia" as Stripe.LatestApiVersion,
    });
  }
  return _stripe;
}

// Lazy proxy — Stripe is instantiated only on first use (not at module evaluation)
// so Next.js build doesn't crash when STRIPE_SECRET_KEY is absent.
export const stripe = new Proxy({} as Stripe, {
  get(_, prop: string | symbol) {
    const instance = getInstance();
    const val = instance[prop as keyof Stripe];
    return typeof val === "function" ? (val as (...a: unknown[]) => unknown).bind(instance) : val;
  },
});
