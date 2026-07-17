"use server";

import { requireAccount } from "@/lib/session";
import { encrypt, decrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import twilio from "twilio";
import type { TwilioStatus } from "@/types";

// ─── Public types ─────────────────────────────────────────────────────────────

export type CredentialInput = {
  accountSid: string;
  authToken: string;
  apiKey: string;
  apiSecret: string;
  phoneNumber: string;
  authMode: "apikey" | "token";
};

export type VerifyResult = {
  ok: boolean;
  status: TwilioStatus;
  message: string;
  phoneNumber?: string;
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function mapTwilioError(err: unknown): { ok: false; status: TwilioStatus; message: string } {
  const e = err as { status?: number; code?: number; message?: string };
  const httpStatus = e?.status ?? 0;
  const twilioCode = e?.code ?? 0;
  const msg = (e?.message ?? "").toLowerCase();

  if (httpStatus === 401 || twilioCode === 20003 || twilioCode === 20103) {
    return { ok: false, status: "INVALID_KEY", message: "Identifiants invalides — vérifiez votre Account SID et Auth Token." };
  }
  if (twilioCode === 20005 || msg.includes("suspend")) {
    return { ok: false, status: "SUSPENDED", message: "Votre compte Twilio est suspendu. Contactez le support Twilio." };
  }
  if (httpStatus === 429) {
    return { ok: false, status: "QUOTA_EXCEEDED", message: "Quota Twilio dépassé. Rechargez votre solde ou attendez quelques secondes." };
  }
  return { ok: false, status: "DISCONNECTED", message: "Impossible de joindre les serveurs Twilio. Vérifiez votre connexion internet." };
}

// ─── Server Actions ───────────────────────────────────────────────────────────

/**
 * Validates Auth Token, auto-creates an API Key for the softphone, stores everything.
 * SECURITY: plain-text credentials never leave this function; never logged.
 */
export async function saveAndVerifyCredentials(input: CredentialInput): Promise<VerifyResult> {
  const ctx = await requireAccount();

  const accountSid = input.accountSid.trim();
  const phoneNumber = input.phoneNumber.trim();

  if (!/^\+[1-9][0-9]{6,14}$/.test(phoneNumber)) {
    return { ok: false, status: "DISCONNECTED", message: "Numéro invalide. Format E.164 attendu (ex. +33612345678)." };
  }
  if (!accountSid.startsWith("AC") || accountSid.length !== 34) {
    return {
      ok: false, status: "INVALID_KEY",
      message: `Account SID invalide — doit commencer par "AC" et faire 34 caractères (reçu : "${accountSid.slice(0, 4)}…", ${accountSid.length} chars).`,
    };
  }

  // ── Mode API Key (recommandé) ────────────────────────────────────────────
  if (input.authMode === "apikey") {
    const apiKeySid = input.apiKey.trim();
    const apiKeySecret = input.apiSecret.trim();
    if (!apiKeySid.startsWith("SK") || apiKeySid.length !== 34) {
      return { ok: false, status: "INVALID_KEY", message: "API Key SID invalide — doit commencer par \"SK\" et faire 34 caractères." };
    }
    if (!apiKeySecret) {
      return { ok: false, status: "INVALID_KEY", message: "L'API Secret est requis." };
    }

    let client: ReturnType<typeof twilio>;
    try {
      client = twilio(apiKeySid, apiKeySecret, { accountSid });
      const account = await client.api.accounts(accountSid).fetch();
      if (account.status === "suspended") {
        return { ok: false, status: "SUSPENDED", message: "Votre compte Twilio est suspendu." };
      }
    } catch (err) {
      return mapTwilioError(err);
    }

    await prisma.twilioConnection.upsert({
      where: { accountId: ctx.accountId },
      update: { encAccountSid: encrypt(accountSid), encAuthToken: null, encApiKey: encrypt(apiKeySid), encApiSecret: encrypt(apiKeySecret), phoneNumber, region: null, status: "CONNECTED", verifiedAt: new Date() },
      create: { accountId: ctx.accountId, encAccountSid: encrypt(accountSid), encAuthToken: null, encApiKey: encrypt(apiKeySid), encApiSecret: encrypt(apiKeySecret), phoneNumber, region: null, status: "CONNECTED" },
    });
    return { ok: true, status: "CONNECTED", message: "Connexion vérifiée via API Key. Le softphone est prêt.", phoneNumber };
  }

  // ── Mode Auth Token ──────────────────────────────────────────────────────
  const authToken = input.authToken.trim();
  if (!authToken) {
    return { ok: false, status: "INVALID_KEY", message: "L'Auth Token est requis." };
  }

  let client: ReturnType<typeof twilio>;
  try {
    client = twilio(accountSid, authToken);
    const account = await client.api.accounts(accountSid).fetch();
    if (account.status === "suspended") {
      return { ok: false, status: "SUSPENDED", message: "Votre compte Twilio est suspendu. Contactez le support Twilio." };
    }
  } catch (err) {
    return mapTwilioError(err);
  }

  // Auto-create an API Key for the Voice SDK (softphone)
  let apiKeySid: string;
  let apiKeySecret: string;
  try {
    const key = await client.newKeys.create({ friendlyName: "KoldKol Softphone" });
    apiKeySid = key.sid;
    apiKeySecret = key.secret;
  } catch (err) {
    const mapped = mapTwilioError(err);
    await prisma.twilioConnection.upsert({
      where: { accountId: ctx.accountId },
      update: { encAccountSid: encrypt(accountSid), encAuthToken: encrypt(authToken), encApiKey: null, encApiSecret: null, phoneNumber, region: null, status: "CONNECTED", verifiedAt: new Date() },
      create: { accountId: ctx.accountId, encAccountSid: encrypt(accountSid), encAuthToken: encrypt(authToken), encApiKey: null, encApiSecret: null, phoneNumber, region: null, status: "CONNECTED" },
    });
    return { ok: true, status: "CONNECTED", message: `Connexion vérifiée. Avertissement : impossible de créer l'API Key automatiquement (${mapped.message}) — le softphone ne sera pas disponible.`, phoneNumber };
  }

  await prisma.twilioConnection.upsert({
    where: { accountId: ctx.accountId },
    update: { encAccountSid: encrypt(accountSid), encAuthToken: encrypt(authToken), encApiKey: encrypt(apiKeySid), encApiSecret: encrypt(apiKeySecret), phoneNumber, region: null, status: "CONNECTED", verifiedAt: new Date() },
    create: { accountId: ctx.accountId, encAccountSid: encrypt(accountSid), encAuthToken: encrypt(authToken), encApiKey: encrypt(apiKeySid), encApiSecret: encrypt(apiKeySecret), phoneNumber, region: null, status: "CONNECTED" },
  });
  return { ok: true, status: "CONNECTED", message: "Connexion vérifiée et API Key créée automatiquement. Le softphone est prêt.", phoneNumber };
}

export async function reverifyConnection(): Promise<VerifyResult> {
  const ctx = await requireAccount();
  const conn = await prisma.twilioConnection.findUnique({ where: { accountId: ctx.accountId } });

  if (!conn?.encAccountSid) {
    return { ok: false, status: "DISCONNECTED", message: "Aucune connexion Twilio configurée pour ce compte." };
  }

  let accountSid: string, authToken: string | null = null;
  try {
    accountSid = decrypt(conn.encAccountSid);
    if (conn.encAuthToken) authToken = decrypt(conn.encAuthToken);
  } catch {
    return { ok: false, status: "INVALID_KEY", message: "Les identifiants stockés sont corrompus. Veuillez les ressaisir." };
  }

  if (!authToken) {
    return { ok: false, status: "INVALID_KEY", message: "Auth Token manquant. Veuillez ressaisir vos identifiants." };
  }

  try {
    const client = twilio(accountSid, authToken);
    const account = await client.api.accounts(accountSid).fetch();
    if (account.status === "suspended") {
      await prisma.twilioConnection.update({ where: { accountId: ctx.accountId }, data: { status: "SUSPENDED", verifiedAt: null } });
      return { ok: false, status: "SUSPENDED", message: "Votre compte Twilio est suspendu." };
    }
    await prisma.twilioConnection.update({ where: { accountId: ctx.accountId }, data: { status: "CONNECTED", verifiedAt: new Date() } });
    return { ok: true, status: "CONNECTED", message: "Connexion vérifiée avec succès.", phoneNumber: conn.phoneNumber };
  } catch (err) {
    const mapped = mapTwilioError(err);
    await prisma.twilioConnection.update({ where: { accountId: ctx.accountId }, data: { status: mapped.status, verifiedAt: null } });
    return mapped;
  }
}
