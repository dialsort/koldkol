import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
        <p className="text-gray-500 mt-1">Configuration de votre compte KoldKol</p>
      </div>

      {/* Twilio config — managed on dedicated page */}
      <div className="rounded-xl bg-white border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-2">Compte Twilio</h2>
        <p className="text-sm text-gray-500 mb-4">
          La configuration Twilio (Account SID, Auth Token, numéro) se fait sur la page dédiée.
        </p>
        <Link
          href="/app/twilio"
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
        >
          Gérer la connexion Twilio →
        </Link>
      </div>

      {/* Legal notice */}
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-5 text-sm text-amber-800">
        <p className="font-semibold mb-2">⚖️ Réglementation Bloctel (France)</p>
        <p>
          Tout appel commercial doit être vérifié sur la liste Bloctel avant d'être passé. KoldKol
          effectue cette vérification automatiquement. Pour activer la vérification Bloctel, ajoutez
          vos identifiants
          <code className="mx-1 bg-amber-100 px-1 rounded">BLOCTEL_LOGIN</code>
          et
          <code className="mx-1 bg-amber-100 px-1 rounded">BLOCTEL_PASSWORD</code>
          dans votre fichier <code className="bg-amber-100 px-1 rounded">.env.local</code>.
        </p>
      </div>
    </div>
  );
}
