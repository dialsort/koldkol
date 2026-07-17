import { requireAccount } from "@/lib/session";
import SessionView from "./SessionView";

export default async function SessionPage({
  searchParams,
}: {
  searchParams: Promise<{ campaignId?: string }>;
}) {
  await requireAccount();
  const { campaignId } = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Session d'appels</h1>
        <p className="mt-1 text-sm text-gray-500">Composez un par un, supervisez chaque appel.</p>
      </div>
      <SessionView initialCampaignId={campaignId ?? null} />
    </div>
  );
}
