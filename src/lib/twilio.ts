import twilio from "twilio";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

export function getTwilioClient(accountSid: string, authToken: string) {
  return twilio(accountSid, authToken);
}

/**
 * Returns a ready Twilio client + calling number for a given account.
 * Decrypts credentials from TwilioConnection using lib/crypto.ts.
 * SECURITY: decrypted values are used only to instantiate the SDK client;
 *           they are never logged or serialised.
 */
export async function getTwilioClientForAccount(accountId: string) {
  const conn = await prisma.twilioConnection.findUnique({
    where: { accountId },
    select: {
      encAccountSid: true,
      encAuthToken: true,
      encApiKey: true,
      encApiSecret: true,
      phoneNumber: true,
      region: true,
      status: true,
    },
  });

  if (!conn || conn.status !== "CONNECTED") {
    throw new Error("Twilio connection not configured or not connected");
  }

  if (!conn.encAccountSid) {
    throw new Error("TwilioConnection is missing encAccountSid");
  }

  const accountSid = decrypt(conn.encAccountSid);
  const regionOpts = conn.region ? { region: conn.region } : {};

  if (conn.encApiKey && conn.encApiSecret) {
    const apiKey = decrypt(conn.encApiKey);
    const apiSecret = decrypt(conn.encApiSecret);
    return {
      client: twilio(apiKey, apiSecret, { accountSid, ...regionOpts }),
      phone: conn.phoneNumber,
      accountSid,
    };
  }

  if (conn.encAuthToken) {
    const authToken = decrypt(conn.encAuthToken);
    return {
      client: twilio(accountSid, authToken, regionOpts),
      phone: conn.phoneNumber,
      accountSid,
    };
  }

  throw new Error("TwilioConnection has no usable credentials");
}

/**
 * Issues a Twilio Voice SDK Access Token for the given user.
 * Requires API Key credentials (API Key + Secret + Account SID).
 * Auth-token-only accounts cannot issue Access Tokens (Twilio constraint).
 */
export async function getVoiceAccessToken(accountId: string, userId: string): Promise<string> {
  const conn = await prisma.twilioConnection.findUnique({
    where: { accountId },
    select: {
      encAccountSid: true,
      encApiKey: true,
      encApiSecret: true,
      region: true,
      status: true,
    },
  });

  if (!conn || conn.status !== "CONNECTED") {
    throw new Error("Twilio connection not configured or not connected");
  }
  if (!conn.encAccountSid) {
    throw new Error("TwilioConnection is missing encAccountSid");
  }

  const accountSid = decrypt(conn.encAccountSid);

  if (!conn.encApiKey || !conn.encApiSecret) {
    throw new Error("API_KEY_REQUIRED");
  }

  const keySid = decrypt(conn.encApiKey);
  const keySecret = decrypt(conn.encApiSecret);

  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const token = new AccessToken(accountSid, keySid, keySecret, {
    identity: userId,
    ttl: 3600,
  });
  // incomingAllow: true — allows the browser Device to receive bridge calls.
  // No outgoingApplicationSid needed: this power dialer only receives (server places calls).
  token.addGrant(new VoiceGrant({ incomingAllow: true }));

  return token.toJwt();
}

/**
 * Places an outbound call to a prospect with async AMD.
 *
 * AMD bias strategy: we do not tune ML thresholds. Instead the amd-result webhook
 * treats `machine_start` and `unknown` as potential humans (false human > false machine).
 * Only `machine_end_*` (confirmed voicemail greeter) triggers hangup.
 *
 * Parameters documented:
 *  - asyncAmd "true"           → AMD runs async; call connects to TwiML URL immediately
 *  - machineDetectionTimeout 6 → up to 6 s for AMD (default 5; extended for slower greetings)
 *  - timeout 25                → ring timeout before Twilio gives up
 */
export async function placeDialerCall({
  to,
  from,
  client,
  callAttemptId,
  accountId,
  agentId,
}: {
  to: string;
  from: string;
  client: twilio.Twilio;
  callAttemptId: string;
  accountId: string;
  agentId: string;
}) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const common = `aid=${encodeURIComponent(accountId)}&cid=${encodeURIComponent(callAttemptId)}`;

  const call = await client.calls.create({
    to,
    from,
    // TwiML served when prospect picks up; holds the line while AMD runs async
    url: `${base}/api/webhooks/twiml?${common}`,
    // Call lifecycle events (fallback for no-answer / failed / busy)
    statusCallback: `${base}/api/webhooks/call-status?${common}`,
    statusCallbackMethod: "POST",
    statusCallbackEvent: ["completed", "no-answer", "busy", "failed"],
    // Async AMD — fires amd-result webhook independently of the call TwiML
    machineDetection: "Enable",
    asyncAmd: "true",
    asyncAmdStatusCallback: `${base}/api/webhooks/amd-result?${common}&uid=${encodeURIComponent(agentId)}`,
    asyncAmdStatusCallbackMethod: "POST",
    machineDetectionTimeout: 6,
    timeout: 25,
  });

  return call;
}

export function validateTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>,
  authToken: string
): boolean {
  return twilio.validateRequest(authToken, signature, url, params);
}

/** TwiML that bridges the prospect's call to the agent's browser Device. */
export function buildBridgeTwiml(agentId: string, dialActionUrl: string): string {
  // En XML, le & dans les attributs doit être &amp; — sinon Twilio rejette le TwiML
  // et joue le message d'erreur "application error" sans jamais exécuter le <Dial>.
  const safeUrl = dialActionUrl.replace(/&/g, "&amp;");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial action="${safeUrl}" timeout="15" method="POST">
    <Client>${agentId}</Client>
  </Dial>
</Response>`;
}

/** TwiML that immediately hangs up (used for confirmed machine / fax). */
export const HANGUP_TWIML = `<?xml version="1.0" encoding="UTF-8"?>
<Response><Hangup/></Response>`;
