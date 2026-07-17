import { requireAccount } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import ProspectList from "./ProspectList";
import ImportButton from "./ImportButton";
import AddProspectButton from "./AddProspectButton";

export default async function ProspectsPage() {
  const ctx = await requireAccount();

  const [prospects, tags, dispositions, lists] = await Promise.all([
    prisma.prospect.findMany({
      where: { accountId: ctx.accountId },
      select: {
        id: true,
        company: true,
        contactName: true,
        phoneNumber: true,
        status: true,
        listId: true,
        createdAt: true,
        tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
        slotStats: { select: { attempts: true, humanAnswers: true } },
        callAttempts: {
          select: {
            id: true, startedAt: true, slot: true, result: true,
            disposition: { select: { id: true, label: true, behavior: true } },
          },
          orderBy: { startedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.tag.findMany({
      where: { accountId: ctx.accountId },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
    prisma.disposition.findMany({
      where: { accountId: ctx.accountId },
      select: { id: true, label: true, behavior: true },
      orderBy: [{ kind: "asc" }, { label: "asc" }],
    }),
    prisma.prospectList.findMany({
      where: { accountId: ctx.accountId },
      select: { id: true, name: true, importedAt: true, _count: { select: { prospects: true } } },
      orderBy: { importedAt: "desc" },
    }),
  ]);

  const activeCount = prospects.filter((p) => p.status === "ACTIVE").length;
  const excludedCount = prospects.length - activeCount;
  const companies = [...new Set(prospects.map((p) => p.company).filter(Boolean) as string[])].sort();

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div
        className="flex items-start justify-between"
        style={{ animation: "slide-up-sm 0.5s cubic-bezier(0.16,1,0.3,1) both" }}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Prospects</h1>
          <div className="mt-1.5 flex items-center gap-3">
            <span className="text-sm text-gray-400">{prospects.length} total</span>
            {activeCount > 0 && (
              <span className="rounded-full bg-green-50 border border-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-600">
                {activeCount} actifs
              </span>
            )}
            {excludedCount > 0 && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                {excludedCount} exclus
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AddProspectButton lists={lists} />
          <ImportButton companies={companies} lists={lists} />
          <a
            href="/api/export/prospects"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:border-red-200 hover:text-red-600 hover:bg-red-50/40 transition-all duration-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
          >
            ↓ Export CSV
          </a>
        </div>
      </div>

      <ProspectList
        prospects={prospects}
        allTags={tags}
        allDispositions={dispositions}
        lists={lists}
        companies={companies}
      />
    </div>
  );
}
