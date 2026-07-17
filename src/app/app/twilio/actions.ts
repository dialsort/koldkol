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
  phoneNumber: string;
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

  if (!/^\+33[0-9]{9}$/.test(input.phoneNumber)) {
    return { ok: false, status: "DISCONNECTED", message: "Numéro invalide. Format attendu : +33XXXXXXXXX (ex. +33612345678)." };
  }
  if (!input.accountSid.trim().startsWith("AC") || input.accountSid.trim().length !== 34) {
    return {
      ok: false, status: "INVALID_KEY",
      message: `Account SID invalide — doit commencer par "AC" et faire 34 caractères (reçu : "${input.accountSid.trim().slice(0, 4)}…", ${input.accountSid.trim().length} chars).`,
    };
  }
  if (!input.authToken.trim()) {
    return { ok: false, status: "INVALID_KEY", message: "L'Auth Token est requis." };
  }

  const accountSid = input.accountSid.trim();
  const authToken = input.authToken.trim();

  // Step 1 — verify Auth Token works
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

  // Step 2 — auto-create an API Key for the Voice SDK (softphone)
  // Auth Token can't sign Access Tokens directly; an API Key is required by Twilio.
  let apiKeySid: string;
  let apiKeySecret: string;
  try {
    const key = await client.newKeys.create({ friendlyName: "KoldKol Softphone" });
    apiKeySid = key.sid;
    apiKeySecret = key.secret; // shown only once — we encrypt it immediately
  } catch (err) {
    // Non-fatal: save without API Key, softphone won't work but dialer will
    const mapped = mapTwilioError(err);
    await prisma.twilioConnection.upsert({
      where: { accountId: ctx.accountId },
      update: { encAccountSid: encrypt(accountSid), encAuthToken: encrypt(authToken), encApiKey: null, encApiSecret: null, phoneNumber: input.phoneNumber, region: null, status: "CONNECTED", verifiedAt: new Date() },
      create: { accountId: ctx.accountId, encAccountSid: encrypt(accountSid), encAuthToken: encrypt(authToken), encApiKey: null, encApiSecret: null, phoneNumber: input.phoneNumber, region: null, status: "CONNECTED" },
    });
    return { ok: true, status: "CONNECTED", message: `Connexion vérifiée. Avertissement : impossible de créer l'API Key automatiquement (${mapped.message}) — le softphone ne sera pas disponible.`, phoneNumber: input.phoneNumber };
  }

  // Step 3 — encrypt and persist everything
  await prisma.twilioConnection.upsert({
    where: { accountId: ctx.accountId },
    update: {
      encAccountSid: encrypt(accountSid),
      encAuthToken: encrypt(authToken),
      encApiKey: encrypt(apiKeySid),
      encApiSecret: encrypt(apiKeySecret),
      phoneNumber: input.phoneNumber,
      region: null,
      status: "CONNECTED",
      verifiedAt: new Date(),
    },
    create: {
      accountId: ctx.accountId,
      encAccountSid: encrypt(accountSid),
      encAuthToken: encrypt(authToken),
      encApiKey: encrypt(apiKeySid),
      encApiSecret: encrypt(apiKeySecret),
      phoneNumber: input.phoneNumber,
      region: null,
      status: "CONNECTED",
    },
  });

  return {
    ok: true,
    status: "CONNECTED",
    message: "Connexion vérifiée et API Key créée automatiquement. Le softphone est prêt.",
    phoneNumber: input.phoneNumber,
  };
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
