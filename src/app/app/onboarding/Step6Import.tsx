"use client";

import { useState, useTransition, useRef } from "react";
import { importProspects } from "./actions";
import type { ImportRow, ImportResult } from "./actions";

// ─── CSV parser ───────────────────────────────────────────────────────────────

function detectDelimiter(line: string): string {
  return (line.match(/;/g) ?? []).length >= (line.match(/,/g) ?? []).length ? ";" : ",";
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === delimiter && !inQuote) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

function detectCols(headers: string[]) {
  const find = (keys: string[]) =>
    headers.find((h) => keys.some((k) => norm(h).includes(k))) ?? null;

  return {
    phone: find(["telephone", "tel", "mobile", "phone", "numero"]),
    firstName: find(["prenom", "firstname", "first name"]),
    lastName: headers.find((h) => {
      const n = norm(h);
      return (n === "nom" || n.startsWith("nom ")) && !n.includes("telephone") && !n.includes("numero");
    }) ?? null,
    company: find(["societe", "company", "entreprise", "raison"]),
  };
}

function csvToRows(text: string): { rows: ImportRow[]; error?: string } {
  const cleaned = text.replace(/^﻿/, "").trim();
  const lines = cleaned.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { rows: [], error: "Le fichier est vide ou ne contient pas de données." };

  const delim = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delim);
  const cols = detectCols(headers);

  if (!cols.phone) {
    return {
      rows: [],
      error: `Colonne "Téléphone" introuvable. En-têtes détectés : ${headers.join(", ")}`,
    };
  }

  const phoneIdx = headers.indexOf(cols.phone);
  const firstIdx = cols.firstName ? headers.indexOf(cols.firstName) : -1;
  const lastIdx = cols.lastName ? headers.indexOf(cols.lastName) : -1;
  const companyIdx = cols.company ? headers.indexOf(cols.company) : -1;

  const rows: ImportRow[] = lines.slice(1).map((line) => {
    const vals = parseCsvLine(line, delim);
    const get = (i: number) => (i >= 0 ? (vals[i] ?? "").trim() : "");
    const parts = [get(firstIdx), get(lastIdx)].filter(Boolean);
    return {
      phoneNumber: get(phoneIdx),
      contactName: parts.length ? parts.join(" ") : undefined,
      company: get(companyIdx) || undefined,
    };
  });

  return { rows };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LegalCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 cursor-pointer hover:bg-amber-100/50 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-amber-300 accent-red-600 shrink-0"
      />
      <span className="text-sm text-amber-800">
        Je déclare disposer d&apos;une base légale (intérêt légitime ou consentement) pour traiter
        ces données personnelles conformément au RGPD.
      </span>
    </label>
  );
}

function ImportSuccess({ result }: { result: ImportResult }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 px-6 py-6 flex items-start gap-4">
      <div className="h-10 w-10 rounded-full bg-green-100 border border-green-200 flex items-center justify-center shrink-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div>
        <p className="font-bold text-green-800 mb-1">Import réussi</p>
        <p className="text-sm text-green-700">{result.message}</p>
        <p className="text-sm text-green-600 mt-1">
          Vos prospects sont maintenant disponibles dans la section <strong>Prospects</strong>.
        </p>
      </div>
    </div>
  );
}

// ─── CSV tab ──────────────────────────────────────────────────────────────────

function CsvTab({
  onImport,
  isPending,
}: {
  onImport: (rows: ImportRow[], listName: string) => void;
  isPending: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [legalOk, setLegalOk] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name.replace(/\.csv$/i, ""));
    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { rows: parsed, error: err } = csvToRows(text);
      if (err) { setError(err); setRows([]); }
      else setRows(parsed);
    };
    reader.readAsText(file, "UTF-8");
  }

  const preview = rows.slice(0, 5);

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <div
        onClick={() => fileRef.current?.click()}
        className="group flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 py-10 cursor-pointer hover:border-red-300 hover:bg-red-50/30 transition-all"
      >
        <div className="h-11 w-11 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center group-hover:border-red-200 transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-700 group-hover:text-red-700 transition-colors">
            {rows.length > 0 ? `${fileName || "fichier"} — ${rows.length} lignes` : "Choisir un fichier CSV"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {rows.length > 0 ? "Cliquer pour changer" : "Format Excel ou Google Sheets (.csv)"}
          </p>
        </div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
      </div>

      {/* Sample download */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          Colonnes reconnues : <span className="font-medium text-gray-600">Téléphone</span> (obligatoire),{" "}
          Prénom, Nom, Société
        </p>
        <a href="/sample-import.csv" download className="text-xs text-red-600 hover:underline font-medium">
          ↓ Exemple CSV
        </a>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-100 px-4 py-2 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Aperçu</p>
            <span className="text-[10px] text-gray-400">{rows.length} ligne{rows.length !== 1 ? "s" : ""} détectée{rows.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {preview.map((r, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center gap-4">
                <code className="text-xs font-mono text-gray-700 w-32 shrink-0">{r.phoneNumber}</code>
                <span className="text-xs text-gray-500 truncate">{[r.contactName, r.company].filter(Boolean).join(" · ") || "—"}</span>
              </div>
            ))}
            {rows.length > 5 && (
              <div className="px-4 py-2.5 text-xs text-gray-400">
                + {rows.length - 5} autres ligne{rows.length - 5 !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <LegalCheckbox checked={legalOk} onChange={setLegalOk} />
          <button
            onClick={() => onImport(rows, fileName || "Import onboarding")}
            disabled={!legalOk || isPending}
            className="btn-red w-full py-3 text-sm font-bold disabled:opacity-50"
          >
            {isPending ? "Import en cours…" : `Importer ${rows.length} prospect${rows.length !== 1 ? "s" : ""} →`}
          </button>
        </>
      )}
    </div>
  );
}

// ─── Manual tab ───────────────────────────────────────────────────────────────

function ManualTab({
  onImport,
  isPending,
}: {
  onImport: (rows: ImportRow[], listName: string) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({ phoneNumber: "", company: "", contactName: "" });
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [legalOk, setLegalOk] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  function addRow() {
    if (!form.phoneNumber.trim()) { setFormError("Le numéro de téléphone est obligatoire."); return; }
    setFormError(null);
    setRows((r) => [
      ...r,
      {
        phoneNumber: form.phoneNumber.trim(),
        company: form.company.trim() || undefined,
        contactName: form.contactName.trim() || undefined,
      },
    ]);
    setForm({ phoneNumber: "", company: "", contactName: "" });
  }

  const inputClass =
    "w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-100 transition-all";

  return (
    <div className="space-y-5">
      {/* Form */}
      <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Téléphone <span className="text-red-500">*</span>
            </label>
            <input
              value={form.phoneNumber}
              onChange={set("phoneNumber")}
              placeholder="+33612345678"
              className={`${inputClass} font-mono`}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRow())}
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Société
            </label>
            <input
              value={form.company}
              onChange={set("company")}
              placeholder="Acme Corp"
              className={inputClass}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRow())}
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Nom du contact
            </label>
            <input
              value={form.contactName}
              onChange={set("contactName")}
              placeholder="Jean Dupont"
              className={inputClass}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRow())}
            />
          </div>
        </div>
        {formError && <p className="text-xs text-red-600">{formError}</p>}
        <button
          type="button"
          onClick={addRow}
          className="w-full rounded-xl border-2 border-dashed border-gray-200 py-2.5 text-sm font-semibold text-gray-500 hover:border-red-300 hover:text-red-600 hover:bg-red-50/30 transition-all"
        >
          + Ajouter ce contact
        </button>
      </div>

      {/* List */}
      {rows.length > 0 && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-100 px-4 py-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              {rows.length} contact{rows.length !== 1 ? "s" : ""} à importer
            </p>
          </div>
          <div className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
            {rows.map((r, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <code className="text-xs font-mono text-gray-700 shrink-0">{r.phoneNumber}</code>
                  <span className="text-xs text-gray-500 truncate">
                    {[r.contactName, r.company].filter(Boolean).join(" · ") || "—"}
                  </span>
                </div>
                <button
                  onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                  className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
                  aria-label="Supprimer"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <LegalCheckbox checked={legalOk} onChange={setLegalOk} />
          <button
            onClick={() => onImport(rows, "Ajout manuel — onboarding")}
            disabled={!legalOk || isPending}
            className="btn-red w-full py-3 text-sm font-bold disabled:opacity-50"
          >
            {isPending ? "Import en cours…" : `Importer ${rows.length} contact${rows.length !== 1 ? "s" : ""} →`}
          </button>
        </>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function Step6Import() {
  const [tab, setTab] = useState<"csv" | "manual">("csv");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ImportResult | null>(null);

  function handleImport(rows: ImportRow[], listName: string) {
    startTransition(async () => {
      const res = await importProspects(rows, listName);
      setResult(res);
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Importez vos prospects pour préparer votre première session d&apos;appels. Vous pourrez en
        ajouter d&apos;autres à tout moment depuis la section <strong>Prospects</strong>.
      </p>

      {result ? (
        <ImportSuccess result={result} />
      ) : (
        <>
          {/* Tab switch */}
          <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
            {(["csv", "manual"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
                  tab === t
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t === "csv" ? "📄 Importer un CSV" : "✏️ Ajout manuel"}
              </button>
            ))}
          </div>

          {tab === "csv" ? (
            <CsvTab onImport={handleImport} isPending={isPending} />
          ) : (
            <ManualTab onImport={handleImport} isPending={isPending} />
          )}
        </>
      )}
    </div>
  );
}
