import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/session";
import { getVoiceAccessToken } from "@/lib/twilio";

export async function GET() {
  const ctx = await requireAccount();

  let token: string;
  try {
    token = await getVoiceAccessToken(ctx.accountId, ctx.userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN";
    if (message.startsWith("API_KEY_REQUIRED")) {
      return NextResponse.json({ error: "API_KEY_REQUIRED" }, { status: 400 });
    }
    if (message.includes("not configured")) {
      return NextResponse.json({ error: "DISCONNECTED" }, { status: 503 });
    }
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }

  return NextResponse.json({ token, identity: ctx.userId });
}
