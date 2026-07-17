import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/session";
import { ADDITIONAL_PACK_CREDITS } from "@/lib/plan-config";
import { stripe } from "@/lib/stripe";
import { getPackPriceId } from "@/lib/stripe-prices";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const ctx = await requireAccount();

  let packs: unknown;
  try {
    ({ packs } = (await request.json()) as { packs: unknown });
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  if (typeof packs !== "number" || !Number.isInteger(packs) || packs < 1 || packs > 10) {
    return NextResponse.json({ error: "INVALID_PACKS" }, { status: 400 });
  }

  const account = await prisma.account.findUniqueOrThrow({
    where: { id: ctx.accountId },
    select: { name: true, stripeCustomerId: true },
  });

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

  const priceId = await getPackPriceId();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";

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
