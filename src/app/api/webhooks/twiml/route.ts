import { parseTwilioWebhook, twimlResponse, forbidden } from "@/lib/webhooks";

// TwiML de maintien servi quand le prospect décroche.
// Joue le silence pendant que l'AMD async tourne en parallèle (3–6 s typiquement).
// Si l'AMD arrive avant la fin de la pause, calls.update() l'interrompt.
// Le <Hangup/> final est un filet de sécurité : si l'AMD ne répond jamais,
// le prospect raccroche proprement plutôt que d'entendre "application error".
const HOLD_TWIML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="25"/>
  <Hangup/>
</Response>`;

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("aid");

  console.log(`[twiml] POST reçu — accountId=${accountId} url=${request.url}`);

  if (!accountId) return forbidden();

  const { ok } = await parseTwilioWebhook(request, accountId);
  if (!ok) return forbidden();

  console.log(`[twiml] Envoi HOLD_TWIML pour account=${accountId}`);
  return twimlResponse(HOLD_TWIML);
}

export const GET = POST;
