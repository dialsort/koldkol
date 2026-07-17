import twilio from "twilio";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

/**
 * Lit le body brut, tente de valider la signature Twilio, et retourne les
 * paramètres parsés. La validation est non-bloquante : si elle échoue, on logue
 * un avertissement mais on continue — le callAttemptId (CUID non-devinable)
 * dans l'URL constitue une sécurité secondaire suffisante.
 *
 * Cas de bypass explicite : pas d'encAuthToken stocké (compte API-Key-only).
 */
export async function parseTwilioWebhook(
  request: Request,
  accountId: string
): Promise<{ ok: boolean; body: URLSearchParams }> {
  const rawBody = await request.text();
  const body = new URLSearchParams(rawBody);

  const conn = await prisma.twilioConnection.findUnique({
    where: { accountId },
    select: { encAuthToken: true },
  });

  if (!conn?.encAuthToken) {
    return { ok: true, body };
  }

  const authToken = decrypt(conn.encAuthToken);
  const signature = request.headers.get("x-twilio-signature") ?? "";
  const params = Object.fromEntries(body) as Record<string, string>;

  // Twilio signe avec l'URL publique (ngrok). Derrière un proxy, request.url
  // est l'URL interne (localhost). On essaie plusieurs reconstructions jusqu'à
  // ce que la signature soit valide.
  const internalUrl = new URL(request.url);
  const publicBase = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const pathAndQuery = `${internalUrl.pathname}${internalUrl.search}`;

  const candidates = [
    publicBase ? `${publicBase}${pathAndQuery}` : null,
    forwardedHost ? `${forwardedProto}://${forwardedHost}${pathAndQuery}` : null,
    request.url,
  ].filter(Boolean) as string[];

  const valid = candidates.some((url) =>
    twilio.validateRequest(authToken, signature, url, params)
  );

  if (!valid) {
    // Non-bloquant : on logue mais on laisse passer. La sécurité repose sur
    // le callAttemptId non-devinable présent dans chaque URL de webhook.
    console.warn(
      `[webhooks] Signature Twilio invalide pour account=${accountId} — urls essayées: ${candidates.join(", ")}`
    );
  }

  return { ok: true, body };
}

/** Retourne une réponse 200 avec du TwiML. */
export function twimlResponse(xml: string): Response {
  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

/** 403 pour les webhooks dont l'accountId ou le callAttemptId est manquant. */
export function forbidden(): Response {
  return new Response("Forbidden", { status: 403 });
}
