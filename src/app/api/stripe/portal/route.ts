import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export async function POST() {
  const ctx = await requireAccount();

  const account = await prisma.account.findUniqueOrThrow({
    where: { id: ctx.accountId },
    select: { stripeCustomerId: true },
  });

  if (!account.stripeCustomerId) {
    return NextResponse.json({ error: "NO_CUSTOMER" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const session = await stripe.billingPortal.sessions.create({
    customer: account.stripeCustomerId,
    return_url: `${appUrl}/app/billing`,
  });

  return NextResponse.json({ url: session.url });
}
