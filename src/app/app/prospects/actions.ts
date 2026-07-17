"use server";

import { requireAccount } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { DispositionBehavior } from "@/types";

export async function addNote(prospectId: string, body: string): Promise<void> {
  if (!body.trim()) throw new Error("Note vide");
  const ctx = await requireAccount();
  const prospect = await prisma.prospect.findUnique({
    where: { id: prospectId, accountId: ctx.accountId },
    select: { id: true },
  });
  if (!prospect) throw new Error("Prospect introuvable");
  await prisma.note.create({
    data: { accountId: ctx.accountId, prospectId, authorId: ctx.userId, body: body.trim() },
  });
  revalidatePath(`/app/prospects/${prospectId}`);
}

export async function addTag(prospectId: string, tagId: string): Promise<void> {
  const ctx = await requireAccount();
  const [prospect, tag] = await Promise.all([
    prisma.prospect.findUnique({
      where: { id: prospectId, accountId: ctx.accountId },
      select: { id: true },
    }),
    prisma.tag.findUnique({ where: { id: tagId, accountId: ctx.accountId }, select: { id: true } }),
  ]);
  if (!prospect || !tag) throw new Error("Introuvable");
  await prisma.prospectTag.upsert({
    where: { prospectId_tagId: { prospectId, tagId } },
    create: { prospectId, tagId },
    update: {},
  });
  revalidatePath(`/app/prospects/${prospectId}`);
}

export async function removeTag(prospectId: string, tagId: string): Promise<void> {
  const ctx = await requireAccount();
  const prospect = await prisma.prospect.findUnique({
    where: { id: prospectId, accountId: ctx.accountId },
    select: { id: true },
  });
  if (!prospect) throw new Error("Prospect introuvable");
  await prisma.prospectTag.delete({ where: { prospectId_tagId: { prospectId, tagId } } });
  revalidatePath(`/app/prospects/${prospectId}`);
}

export async function excludeProspect(prospectId: string): Promise<void> {
  const ctx = await requireAccount();
  const prospect = await prisma.prospect.findUnique({
    where: { id: prospectId, accountId: ctx.accountId },
    select: { id: true, status: true },
  });
  if (!prospect) throw new Error("Prospect introuvable");
  if (prospect.status === "EXCLUDED") return;
  await prisma.prospect.update({
    where: { id: prospectId },
    data: { status: "EXCLUDED", excludedAt: new Date() },
  });
  revalidatePath(`/app/prospects/${prospectId}`);
  revalidatePath("/app/prospects");
}

export async function saveDisposition(
  callAttemptId: string,
  dispositionId: string,
  callbackAt?: string
): Promise<void> {
  const ctx = await requireAccount();
  const [attempt, disposition] = await Promise.all([
    prisma.callAttempt.findUnique({
      where: { id: callAttemptId, accountId: ctx.accountId },
      select: { id: true, prospectId: true },
    }),
    prisma.disposition.findUnique({
      where: { id: dispositionId, accountId: ctx.accountId },
      select: { id: true },
    }),
  ]);
  if (!attempt || !disposition) throw new Error("Introuvable");
  await prisma.callAttempt.update({
    where: { id: callAttemptId },
    data: {
      dispositionId,
      ...(callbackAt ? { callbackAt: new Date(callbackAt) } : {}),
    },
  });
  revalidatePath(`/app/prospects/${attempt.prospectId}`);
}

export async function createDisposition(
  label: string,
  behavior: DispositionBehavior
): Promise<{ id: string; label: string; behavior: DispositionBehavior; kind: string }> {
  const ctx = await requireAccount();
  return prisma.disposition.create({
    data: { accountId: ctx.accountId, label: label.trim(), kind: "CUSTOM", behavior },
    select: { id: true, label: true, behavior: true, kind: true },
  });
}

export async function updateDisposition(
  id: string,
  label: string,
  behavior: DispositionBehavior
): Promise<void> {
  const ctx = await requireAccount();
  const disp = await prisma.disposition.findUnique({
    where: { id, accountId: ctx.accountId },
    select: { kind: true },
  });
  if (!disp) throw new Error("Disposition introuvable");
  if (disp.kind === "SYSTEM") throw new Error("Impossible de modifier une disposition système");
  await prisma.disposition.update({ where: { id }, data: { label: label.trim(), behavior } });
}

export async function deleteDisposition(id: string): Promise<void> {
  const ctx = await requireAccount();
  const disp = await prisma.disposition.findUnique({
    where: { id, accountId: ctx.accountId },
    select: { kind: true },
  });
  if (!disp) throw new Error("Disposition introuvable");
  if (disp.kind === "SYSTEM") throw new Error("Impossible de supprimer une disposition système");
  await prisma.disposition.delete({ where: { id } });
}

// ─── Prospect CRUD & bulk actions ─────────────────────────────────────────────

export async function updateProspect(
  id: string,
  data: { company?: string | null; contactName?: string | null; phoneNumber?: string }
): Promise<void> {
  const ctx = await requireAccount();
  await prisma.prospect.update({ where: { id, accountId: ctx.accountId }, data });
  revalidatePath("/app/prospects");
}

export async function deleteProspects(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const ctx = await requireAccount();
  await prisma.prospect.deleteMany({ where: { id: { in: ids }, accountId: ctx.accountId } });
  revalidatePath("/app/prospects");
}

export async function setProspectsStatus(
  ids: string[],
  status: "ACTIVE" | "EXCLUDED"
): Promise<void> {
  if (!ids.length) return;
  const ctx = await requireAccount();
  await prisma.prospect.updateMany({
    where: { id: { in: ids }, accountId: ctx.accountId },
    data: { status, excludedAt: status === "EXCLUDED" ? new Date() : null },
  });
  revalidatePath("/app/prospects");
}

export async function bulkAddTag(prospectIds: string[], tagId: string): Promise<void> {
  if (!prospectIds.length) return;
  const ctx = await requireAccount();
  const tag = await prisma.tag.findUnique({ where: { id: tagId, accountId: ctx.accountId } });
  if (!tag) throw new Error("Tag introuvable");
  await prisma.$transaction(
    prospectIds.map((prospectId) =>
      prisma.prospectTag.upsert({
        where: { prospectId_tagId: { prospectId, tagId } },
        create: { prospectId, tagId },
        update: {},
      })
    )
  );
  revalidatePath("/app/prospects");
}

export async function bulkRemoveTag(prospectIds: string[], tagId: string): Promise<void> {
  if (!prospectIds.length) return;
  const ctx = await requireAccount();
  const tag = await prisma.tag.findUnique({ where: { id: tagId, accountId: ctx.accountId } });
  if (!tag) throw new Error("Tag introuvable");
  await prisma.prospectTag.deleteMany({ where: { prospectId: { in: prospectIds }, tagId } });
  revalidatePath("/app/prospects");
}

// ─── Prospect list CRUD ───────────────────────────────────────────────────────

export async function createProspectList(name: string, legalBasis: string) {
  const ctx = await requireAccount();
  const list = await prisma.prospectList.create({
    data: { accountId: ctx.accountId, name: name.trim(), legalBasis, legalBasisDeclaredAt: new Date() },
    select: { id: true, name: true },
  });
  revalidatePath("/app/prospects");
  return list;
}

export async function renameProspectList(id: string, name: string): Promise<void> {
  const ctx = await requireAccount();
  await prisma.prospectList.update({ where: { id, accountId: ctx.accountId }, data: { name: name.trim() } });
  revalidatePath("/app/prospects");
}

export async function moveProspectsToList(ids: string[], listId: string): Promise<void> {
  if (!ids.length) return;
  const ctx = await requireAccount();
  await prisma.prospectList.findUniqueOrThrow({ where: { id: listId, accountId: ctx.accountId } });
  await prisma.prospect.updateMany({ where: { id: { in: ids }, accountId: ctx.accountId }, data: { listId } });
  revalidatePath("/app/prospects");
}

export async function deleteProspectList(id: string): Promise<void> {
  const ctx = await requireAccount();
  const list = await prisma.prospectList.findUnique({ where: { id, accountId: ctx.accountId }, select: { id: true } });
  if (!list) throw new Error("Liste introuvable");
  // CallAttempt has no onDelete cascade from Prospect — must delete first
  await prisma.callAttempt.deleteMany({ where: { prospect: { listId: id }, accountId: ctx.accountId } });
  // Prospect deletion cascades ProspectTag, Note, ProspectSlotStat
  await prisma.prospect.deleteMany({ where: { listId: id, accountId: ctx.accountId } });
  await prisma.prospectList.delete({ where: { id } });
  revalidatePath("/app/prospects");
}

export async function importIntoList(
  rows: { phoneNumber: string; company?: string; contactName?: string }[],
  listId: string
): Promise<{ imported: number; skipped: number; message: string }> {
  const ctx = await requireAccount();
  const list = await prisma.prospectList.findUnique({ where: { id: listId, accountId: ctx.accountId } });
  if (!list) throw new Error("Liste introuvable");

  function normalizePhone(raw: string): string | null {
    const s = raw.replace(/[\s.\-()]/g, "");
    if (s.startsWith("+33") && s.length >= 12) return s;
    if (s.startsWith("0033") && s.length >= 13) return "+" + s.slice(2);
    if (s.startsWith("0") && s.length === 10) return "+33" + s.slice(1);
    if (s.startsWith("+") && s.length >= 10) return s;
    return null;
  }

  let imported = 0, skipped = 0;
  for (const row of rows) {
    const phone = normalizePhone(row.phoneNumber);
    if (!phone) { skipped++; continue; }
    try {
      await prisma.prospect.create({
        data: { accountId: ctx.accountId, listId, phoneNumber: phone, company: row.company || null, contactName: row.contactName || null },
      });
      imported++;
    } catch (e: unknown) {
      if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") skipped++;
      else throw e;
    }
  }

  revalidatePath("/app/prospects");
  return {
    ok: true,
    imported,
    skipped,
    message: `${imported} prospect${imported !== 1 ? "s" : ""} importé${imported !== 1 ? "s" : ""}${skipped > 0 ? `, ${skipped} ignoré${skipped !== 1 ? "s" : ""} (doublon ou numéro invalide)` : ""}`,
  } as { ok: true; imported: number; skipped: number; message: string };
}

export async function addProspect(data: {
  phoneNumber: string;
  company?: string;
  contactName?: string;
  listId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireAccount();

  const list = await prisma.prospectList.findUnique({
    where: { id: data.listId, accountId: ctx.accountId },
    select: { id: true },
  });
  if (!list) return { ok: false, error: "Liste introuvable" };

  // Normalize phone to E.164
  function normalizePhone(raw: string): string | null {
    const s = raw.replace(/[\s.\-()]/g, "");
    if (s.startsWith("+33") && s.length >= 12) return s;
    if (s.startsWith("0033") && s.length >= 13) return "+" + s.slice(2);
    if (s.startsWith("0") && s.length === 10) return "+33" + s.slice(1);
    if (s.startsWith("+") && s.length >= 10) return s;
    return null;
  }

  const phone = normalizePhone(data.phoneNumber);
  if (!phone) return { ok: false, error: "Numéro de téléphone invalide" };

  try {
    await prisma.prospect.create({
      data: {
        accountId: ctx.accountId,
        listId: data.listId,
        phoneNumber: phone,
        company: data.company?.trim() || null,
        contactName: data.contactName?.trim() || null,
      },
    });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return { ok: false, error: "Ce numéro existe déjà dans votre compte" };
    }
    throw e;
  }

  revalidatePath("/app/prospects");
  return { ok: true };
}

export async function reactivateProspect(prospectId: string): Promise<void> {
  const ctx = await requireAccount();
  await prisma.prospect.update({
    where: { id: prospectId, accountId: ctx.accountId },
    data: { status: "ACTIVE", excludedAt: null },
  });
  revalidatePath("/app/prospects");
}

export async function getProspectFull(id: string) {
  const ctx = await requireAccount();
  const p = await prisma.prospect.findUnique({
    where: { id, accountId: ctx.accountId },
    select: {
      id: true, company: true, contactName: true, phoneNumber: true,
      status: true, excludedAt: true, createdAt: true,
      list: { select: { name: true, legalBasis: true } },
      tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
      notes: {
        select: { id: true, body: true, createdAt: true, author: { select: { email: true } } },
        orderBy: { createdAt: "desc" },
      },
      callAttempts: {
        select: {
          id: true, startedAt: true, slot: true, result: true, durationSec: true, callbackAt: true,
          disposition: { select: { id: true, label: true, behavior: true } },
        },
        orderBy: { startedAt: "desc" },
      },
    },
  });
  if (!p) return null;
  return {
    ...p,
    createdAt: p.createdAt.toISOString(),
    excludedAt: p.excludedAt?.toISOString() ?? null,
    notes: p.notes.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
    callAttempts: p.callAttempts.map((a) => ({
      ...a,
      startedAt: a.startedAt.toISOString(),
      callbackAt: a.callbackAt?.toISOString() ?? null,
    })),
  };
}

export async function setProspectTags(prospectId: string, tagIds: string[]): Promise<void> {
  const ctx = await requireAccount();
  await prisma.prospect.findUniqueOrThrow({ where: { id: prospectId, accountId: ctx.accountId } });
  await prisma.$transaction([
    prisma.prospectTag.deleteMany({ where: { prospectId } }),
    prisma.prospectTag.createMany({
      data: tagIds.map((tagId) => ({ prospectId, tagId })),
      skipDuplicates: true,
    }),
  ]);
  revalidatePath("/app/prospects");
}
