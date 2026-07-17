import { requireAccount } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import CampaignsView from "./CampaignsView";

export default async function CampaignsPage() {
  const ctx = await requireAccount();

  const [campaigns, prospectLists] = await Promise.all([
    prisma.campaign.findMany({
      where: { accountId: ctx.accountId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { callAttempts: true } },
        prospectLists: {
          include: {
            prospectList: {
              select: { id: true, name: true, _count: { select: { prospects: true } } },
            },
          },
        },
      },
    }),
    prisma.prospectList.findMany({
      where: { accountId: ctx.accountId },
      select: { id: true, name: true, _count: { select: { prospects: true } } },
      orderBy: { importedAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Campagnes</h1>
        <p className="mt-1 text-sm text-gray-500">Gérez vos campagnes d'appels et associez-leur des listes de prospects.</p>
      </div>
      <CampaignsView campaigns={campaigns} prospectLists={prospectLists} />
    </div>
  );
}
