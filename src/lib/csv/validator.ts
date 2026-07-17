// @ts-nocheck — pending rewrite (schema migration lot 2)
import type { MappedContact } from "./parser";

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

const FR_LOCAL_REGEX = /^0[1-9]\d{8}$/;

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[\s.\-()]/g, "");
  if (E164_REGEX.test(digits)) return digits;
  if (FR_LOCAL_REGEX.test(digits)) return "+33" + digits.slice(1);
  return digits;
}

export type ValidationResult = {
  valid: MappedContact[];
  invalid: Array<{ contact: MappedContact; reason: string }>;
};

export function validateContacts(contacts: MappedContact[]): ValidationResult {
  const valid: MappedContact[] = [];
  const invalid: Array<{ contact: MappedContact; reason: string }> = [];
  const seen = new Set<string>();

  for (const c of contacts) {
    if (!c.firstName || !c.lastName) {
      invalid.push({ contact: c, reason: "Nom ou prénom manquant" });
      continue;
    }

    const normalized = normalizePhone(c.phone);
    if (!E164_REGEX.test(normalized)) {
      invalid.push({
        contact: { ...c, phone: normalized },
        reason: `Numéro invalide: ${c.phone}`,
      });
      continue;
    }

    if (seen.has(normalized)) {
      invalid.push({
        contact: { ...c, phone: normalized },
        reason: "Numéro en doublon",
      });
      continue;
    }

    seen.add(normalized);
    valid.push({ ...c, phone: normalized });
  }

  return { valid, invalid };
}
