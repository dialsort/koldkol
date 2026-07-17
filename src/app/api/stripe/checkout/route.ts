import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { getPriceId, getPackPriceId } from "@/lib/stripe-prices";
import { ADDITIONAL_PACK_CREDITS } from "@/lib/plan-config";
import type { Plan, BillingCycle } from "@prisma/client";

const VALID_PLANS = new Set<string>(["ESSENTIEL", "PRO", "EXPERT"]);
const VALID_CYCLES = new Set<string>(["MONTHLY", "ANNUAL"]);

export async function POST(req: Request) {
  const ctx = await requireAccount();

  const account = await prisma.account.findUniqueOrThrow({
    where: { id: ctx.accountId },
    select: { name: true, stripeCustomerId: true },
  });

  // Get or create Stripe customer
  let customerId = account.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: account.name,
      metadata: { kk_account_id: ctx.accountId },
    });
    customerId = customer.id;
    await prisma.account.update({
      where: { id: ctx.accountId },
      data: { stripeCustomerId: customerId },
    });
  }

  const body = (await req.json()) as {
    type?: "subscription" | "pack";
    plan?: string;
    cycle?: string;
    packs?: number;
  };
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";

  // ── One-time credit pack ──────────────────────────────────────────────────
  if (body.type === "pack") {
    const packs = body.packs;
    if (typeof packs !== "number" || !Number.isInteger(packs) || packs < 1 || packs > 10) {
      return NextResponse.json({ error: "INVALID_PACKS" }, { status: 400 });
    }
    const priceId = await getPackPriceId();
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [{ price: priceId, quantity: packs }],
      success_url: `${appUrl}/app/billing?pack_success=1&packs=${packs}`,
      cancel_url: `${appUrl}/app/billing`,
      metadata: {
        kk_account_id: ctx.accountId,
        kk_type: "extra_pack",
        kk_packs: String(packs),
        kk_credits: String(packs * ADDITIONAL_PACK_CREDITS),
      },
    });
    return NextResponse.json({ url: session.url });
  }

  // ── Subscription ──────────────────────────────────────────────────────────
  const { plan, cycle } = body;
  if (!plan || !VALID_PLANS.has(plan)) {
    return NextResponse.json({ error: "INVALID_PLAN" }, { status: 400 });
  }
  if (!cycle || !VALID_CYCLES.has(cycle)) {
    return NextResponse.json({ error: "INVALID_CYCLE" }, { status: 400 });
  }

  const priceId = await getPriceId(plan as Plan, cycle as BillingCycle);
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/app/billing?sub_success=1`,
    cancel_url: `${appUrl}/app/billing`,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: {
        kk_account_id: ctx.accountId,
        kk_plan: plan,
        kk_cycle: cycle,
      },
    },
    metadata: {
      kk_account_id: ctx.accountId,
      kk_plan: plan,
      kk_cycle: cycle,
    },
  });

  return NextResponse.json({ url: session.url });
}
