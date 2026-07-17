// @ts-nocheck — pending rewrite (schema migration lot 2)
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CsvDropzone } from "@/components/import/csv-dropzone";
import { ColumnMapper } from "@/components/import/column-mapper";
import { parseCSV } from "@/lib/csv/parser";
import type { ColumnMapping } from "@/lib/csv/parser";

type Step = "name" | "upload" | "mapping" | "importing";

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("name");
  const [campaignName, setCampaignName] = useState("");
  const [csvContent, setCsvContent] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({});
  const [rowCount, setRowCount] = useState(0);
  const [result, setResult] = useState<{
    imported: number;
    blocked: number;
    invalid: number;
    campaignId: string;
  } | null>(null);
  const [error, setError] = useState("");

  function handleParsed(content: string) {
    const { rows, headers: h } = parseCSV(content);
    setCsvContent(content);
    setHeaders(h);
    setRowCount(rows.length);

    // Auto-map common column names
    const autoMap: Partial<ColumnMapping> = {};
    const normalize = (s: string) => s.toLowerCase().replace(/[\s_-]/g, "");
    for (const header of h) {
      const n = normalize(header);
      if (["prenom", "firstname", "prenom"].includes(n)) autoMap.firstName = header;
      if (["nom", "lastname", "name"].includes(n)) autoMap.lastName = header;
      if (["telephone", "phone", "tel", "mobile", "numero"].includes(n)) autoMap.phone = header;
      if (["email", "mail", "courriel"].includes(n)) autoMap.email = header;
      if (["societe", "company", "entreprise", "organisation"].includes(n))
        autoMap.company = header;
    }
    setMapping(autoMap);
    setStep("upload");
  }

  async function handleImport() {
    if (!mapping.firstName || !mapping.lastName || !mapping.phone) {
      setError("Veuillez mapper au minimum : Prénom, Nom, Téléphone");
      return;
    }

    setStep("importing");
    setError("");

    // Create campaign first
    const campRes = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: campaignName }),
    });

    if (!campRes.ok) {
      setError("Erreur lors de la création de la campagne");
      setStep("mapping");
      return;
    }

    const campaign = await campRes.json();

    const importRes = await fetch("/api/contacts/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId: campaign.id,
        csvContent,
        mapping,
      }),
    });

    const data = await importRes.json();

    if (!importRes.ok) {
      setError(data.error || "Erreur lors de l'import");
      setStep("mapping");
      return;
    }

    setResult({ ...data, campaignId: campaign.id });
  }

  if (result) {
    return (
      <div className="max-w-lg mx-auto text-center space-y-4 mt-16">
        <div className="text-5xl">🎉</div>
        <h2 className="text-2xl font-bold text-gray-900">Import réussi !</h2>
        <div className="rounded-xl bg-white border border-gray-200 p-6 text-left space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Contacts importés</span>
            <span className="font-semibold text-green-600">{result.imported}</span>
          </div>
          {result.blocked > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Bloqués Bloctel</span>
              <span className="font-semibold text-amber-600">{result.blocked}</span>
            </div>
          )}
          {result.invalid > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Numéros invalides</span>
              <span className="font-semibold text-red-600">{result.invalid}</span>
            </div>
          )}
        </div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.push(`/campaigns/${result.campaignId}`)}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Voir la campagne →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nouvelle campagne</h1>
        <p className="text-gray-500 mt-1">Importez votre liste de prospects</p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(["name", "upload", "mapping"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                step === s
                  ? "bg-blue-600 text-white"
                  : ["upload", "mapping"].indexOf(s) <= ["upload", "mapping"].indexOf(step as never)
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 text-gray-500"
              }`}
            >
              {i + 1}
            </div>
            <span className="text-gray-600">
              {s === "name" ? "Nom" : s === "upload" ? "Import" : "Mapping"}
            </span>
            {i < 2 && <span className="text-gray-300">→</span>}
          </div>
        ))}
      </div>

      {/* Step 1: Name */}
      {step === "name" && (
        <div className="rounded-xl bg-white border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Nom de la campagne</h2>
          <input
            type="text"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            placeholder="Ex: Prospects Mai 2025"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          />
          <button
            onClick={() => setStep("upload")}
            disabled={!campaignName.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Continuer →
          </button>
        </div>
      )}

      {/* Step 2: Upload */}
      {(step === "upload" || step === "mapping") && (
        <div className="rounded-xl bg-white border border-gray-200 p-6 space-y-6">
          <div>
            <h2 className="font-semibold text-gray-900 mb-4">Importer le fichier CSV</h2>
            <CsvDropzone onParsed={(content) => handleParsed(content)} />
            {rowCount > 0 && (
              <p className="mt-2 text-sm text-gray-500">{rowCount} lignes détectées</p>
            )}
          </div>

          {headers.length > 0 && (
            <div>
              <h2 className="font-semibold text-gray-900 mb-4">Associer les colonnes</h2>
              <ColumnMapper headers={headers} mapping={mapping} onChange={setMapping} />
            </div>
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          {headers.length > 0 && (
            <div className="flex gap-3">
              <button
                onClick={() => setStep("name")}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                ← Retour
              </button>
              <button
                onClick={handleImport}
                disabled={!mapping.firstName || !mapping.lastName || !mapping.phone}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Importer {rowCount} contacts
              </button>
            </div>
          )}
        </div>
      )}

      {step === "importing" && (
        <div className="rounded-xl bg-white border border-gray-200 p-10 text-center">
          <div className="text-3xl mb-3 animate-pulse">⏳</div>
          <p className="text-gray-600">Import en cours…</p>
        </div>
      )}
    </div>
  );
}
