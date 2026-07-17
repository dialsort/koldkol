import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/session";
import { getTwilioClientForAccount } from "@/lib/twilio";

/**
 * GET /api/twilio/balance
 *
 * Fetches the live Twilio account balance for the authenticated account.
 * The balance is fetched server-side so credentials never reach the browser.
 * Cached for 60s via Cache-Control header (balance doesn't change per-second).
 */
export async function GET() {
  const ctx = await requireAccount();

  try {
    const tw = await getTwilioClientForAccount(ctx.accountId);
    const bal = await tw.client.balance.fetch();
    return NextResponse.json(
      { balance: bal.balance, currency: bal.currency },
      { headers: { "Cache-Control": "private, max-age=60" } }
    );
  } catch {
    return NextResponse.json({ balance: null, currency: "USD" }, { status: 200 });
  }
}
