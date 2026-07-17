import { requireAccount } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import TwilioWizard from "./TwilioWizard";
import type { TwilioStatus } from "@/types";

const STATUS_CONFIG: Record<TwilioStatus, { label: string; dotColor: string; badgeColor: string }> =
  {
    CONNECTED: {
      label: "Connecté",
      dotColor: "bg-green-500",
      badgeColor: "bg-green-100 text-green-700",
    },
    DISCONNECTED: {
      label: "Non configuré",
      dotColor: "bg-gray-400",
      badgeColor: "bg-gray-100 text-gray-500",
    },
    INVALID_KEY: {
      label: "Clé invalide",
      dotColor: "bg-red-500",
      badgeColor: "bg-red-100 text-red-700",
    },
    QUOTA_EXCEEDED: {
      label: "Quota dépassé",
      dotColor: "bg-orange-500",
      badgeColor: "bg-orange-100 text-orange-700",
    },
    SUSPENDED: {
      label: "Compte suspendu",
      dotColor: "bg-red-500",
      badgeColor: "bg-red-100 text-red-700",
    },
  };

function ConnectionBadge({ status }: { status: TwilioStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${cfg.badgeColor}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotColor}`} />
      {cfg.label}
    </span>
  );
}

export default async function TwilioPage() {
  const ctx = await requireAccount();

  const conn = await prisma.twilioConnection.findUnique({
    where: { accountId: ctx.accountId },
    select: { status: true, phoneNumber: true, verifiedAt: true },
  });

  const status = (conn?.status ?? null) as TwilioStatus | null;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Connexion Twilio</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Connectez votre compte Twilio pour activer les appels sortants.
        </p>
      </div>

      {/* Current connection status (only shown when a record exists) */}
      {conn && status && (
        <div className="flex items-center justify-between rounded-xl bg-white border border-gray-200 p-5">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <ConnectionBadge status={status} />
              {conn.phoneNumber && (
                <code className="text-sm font-mono text-gray-700">{conn.phoneNumber}</code>
              )}
            </div>
            {conn.verifiedAt && (
              <p className="text-xs text-gray-400">
                Dernière vérification :{" "}
                {new Date(conn.verifiedAt).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
          {status === "CONNECTED" && (
            <span className="text-xs text-green-600 font-medium">Prêt pour les appels ✓</span>
          )}
        </div>
      )}

      {/* ── Security notice — always visible ── */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 space-y-3">
        <p className="font-semibold flex items-center gap-2">
          🔒 Action requise : Geographic Permissions
        </p>
        <p>
          Dans la console Twilio, restreignez les <strong>Voice Geographic Permissions</strong> à la
          France uniquement (Métropole + DOM-TOM).
        </p>
        <p>
          <strong>Pourquoi :</strong> si vos identifiants étaient compromis, cette restriction
          empêche tout appel vers des numéros internationaux surtaxés à vos frais.
        </p>
        <div className="rounded-lg bg-amber-100 px-4 py-3 font-mono text-xs text-amber-900 space-y-1">
          <p>Console Twilio → Voice → Settings → Geo Permissions</p>
          <p>→ Décocher tout sauf : France (Metropolitan) + France (DOM-TOM)</p>
          <p>→ Enregistrer</p>
        </div>
        <p className="text-amber-600 text-xs">
          Cette configuration se fait côté Twilio et n'est pas contrôlable depuis KoldKol.
        </p>
      </div>

      {/* Wizard */}
      <TwilioWizard initialStatus={status ?? undefined} />
    </div>
  );
}
