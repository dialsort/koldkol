import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { PLAN_CONFIG } from "@/lib/plan-config";
import type Stripe from "stripe";
import type { Plan, BillingCycle } from "@prisma/client";

const VALID_PLANS = new Set<string>(["ESSENTIEL", "PRO", "EXPERT"]);
const VALID_CYCLES = new Set<string>(["MONTHLY", "ANNUAL"]);

function safePlan(v: unknown): Plan | null {
  return typeof v === "string" && VALID_PLANS.has(v) ? (v as Plan) : null;
}
function safeCycle(v: unknown): BillingCycle | null {
  return typeof v === "string" && VALID_CYCLES.has(v) ? (v as BillingCycle) : null;
}

async function grantMonthlyCredits(accountId: string, plan: Plan) {
  await prisma.creditLedger.create({
    data: { accountId, delta: PLAN_CONFIG[plan].monthlyCredits, reason: "PLAN_MONTHLY_GRANT" },
  });
}

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return NextResponse.json({ error: "MISSING_SIGNATURE" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch {
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 400 });
  }

  try {
    switch (event.type) {
      // ── Checkout completed ──────────────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const accountId = session.metadata?.kk_account_id;
        if (!accountId) break;

        if (session.mode === "subscription") {
          const plan = safePlan(session.metadata?.kk_plan);
          const cycle = safeCycle(session.metadata?.kk_cycle);
          if (!plan || !cycle) break;

          await prisma.account.update({
            where: { id: accountId },
            data: {
              plan,
              billingCycle: cycle,
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
              stripeSubscriptionStatus: "active",
            },
          });
          await grantMonthlyCredits(accountId, plan);
        } else if (session.mode === "payment") {
          const credits = parseInt(session.metadata?.kk_credits ?? "0", 10);
          if (credits > 0) {
            await prisma.creditLedger.create({
              data: { accountId, delta: credits, reason: "EXTRA_PACK_PURCHASE" },
            });
          }
        }
        break;
      }

      // ── Subscription updated (plan change, renewal, etc.) ───────────────
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const accountId = sub.metadata?.kk_account_id;
        if (!accountId) break;

        const plan = safePlan(sub.metadata?.kk_plan);
        const cycle = safeCycle(sub.metadata?.kk_cycle);

        await prisma.account.update({
          where: { id: accountId },
          data: {
            stripeSubscriptionStatus: sub.status,
            ...(plan ? { plan } : {}),
            ...(cycle ? { billingCycle: cycle } : {}),
          },
        });
        break;
      }

      // ── Subscription cancelled ──────────────────────────────────────────
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const accountId = sub.metadata?.kk_account_id;
        if (!accountId) break;

        await prisma.account.update({
          where: { id: accountId },
          data: { stripeSubscriptionId: null, stripeSubscriptionStatus: "canceled" },
        });
        break;
      }

      // ── Monthly renewal — grant credits ─────────────────────────────────
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.billing_reason !== "subscription_cycle") break;

        const account = await prisma.account.findFirst({
          where: { stripeCustomerId: invoice.customer as string },
          select: { id: true, plan: true },
        });
        if (!account) break;

        await grantMonthlyCredits(account.id, account.plan);
        break;
      }

      // ── Payment failed ──────────────────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await prisma.account.updateMany({
          where: { stripeCustomerId: invoice.customer as string },
          data: { stripeSubscriptionStatus: "past_due" },
        });
        break;
      }
    }
  } catch (err) {
    console.error("[stripe-webhook]", event.type, err);
    return NextResponse.json({ error: "HANDLER_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
