import { requireAccount } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ProspectCard } from "@/components/ProspectCard";
import Link from "next/link";

export default async function ProspectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAccount();
  const { id } = await params;

  const [prospect, allTags, dispositions] = await Promise.all([
    prisma.prospect.findUnique({
      where: { id, accountId: ctx.accountId },
      select: {
        id: true,
        company: true,
        contactName: true,
        phoneNumber: true,
        status: true,
        excludedAt: true,
        createdAt: true,
        list: { select: { name: true, legalBasis: true } },
        tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
        notes: {
          select: {
            id: true,
            body: true,
            createdAt: true,
            author: { select: { email: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        callAttempts: {
          select: {
            id: true,
            startedAt: true,
            slot: true,
            result: true,
            durationSec: true,
            callbackAt: true,
            disposition: { select: { id: true, label: true, behavior: true } },
          },
          orderBy: { startedAt: "desc" },
        },
      },
    }),
    prisma.tag.findMany({
      where: { accountId: ctx.accountId },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
    prisma.disposition.findMany({
      where: { accountId: ctx.accountId },
      select: { id: true, label: true, behavior: true, kind: true },
      orderBy: [{ kind: "asc" }, { label: "asc" }],
    }),
  ]);

  if (!prospect) notFound();

  // Serialise dates so the client component receives plain strings
  const serialised = {
    ...prospect,
    createdAt: prospect.createdAt.toISOString(),
    excludedAt: prospect.excludedAt?.toISOString() ?? null,
    list: prospect.list,
    tags: prospect.tags,
    notes: prospect.notes.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    })),
    callAttempts: prospect.callAttempts.map((a) => ({
      ...a,
      startedAt: a.startedAt.toISOString(),
      callbackAt: a.callbackAt?.toISOString() ?? null,
    })),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/app/prospects" className="text-sm text-gray-400 hover:text-gray-600">
          ← Prospects
        </Link>
        <span className="text-gray-200">/</span>
        <h1 className="text-xl font-bold text-gray-900">
          {prospect.company ?? prospect.contactName ?? prospect.phoneNumber}
        </h1>
      </div>
      <ProspectCard prospect={serialised} allTags={allTags} dispositions={dispositions} />
    </div>
  );
}
