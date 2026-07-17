"use client";

import { useRef, useState, useTransition } from "react";
import { importProspects } from "@/app/app/onboarding/actions";
import type { ImportRow } from "@/app/app/onboarding/actions";
import { importIntoList } from "./actions";
import { useRouter } from "next/navigation";

// ─── CSV parser ───────────────────────────────────────────────────────────────

function detectDelimiter(line: string) {
  return (line.match(/;/g) ?? []).length >= (line.match(/,/g) ?? []).length ? ";" : ",";
}
function parseLine(line: string, delim: string): string[] {
  const result: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (ch === delim && !inQ) { result.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  result.push(cur.trim());
  return result;
}
function norm(s: string) { return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim(); }
function csvToRows(text: string): { rows: ImportRow[]; error?: string } {
  const lines = text.replace(/^﻿/, "").trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { rows: [], error: "Fichier vide." };
  const delim = detectDelimiter(lines[0]);
  const headers = parseLine(lines[0], delim);
  const find = (keys: string[]) => headers.find((h) => keys.some((k) => norm(h).includes(k))) ?? null;
  const phoneCol = find(["telephone", "tel", "mobile", "phone", "numero"]);
  if (!phoneCol) return { rows: [], error: `Colonne "Téléphone" introuvable. En-têtes : ${headers.join(", ")}` };
  const phoneIdx = headers.indexOf(phoneCol);
  const firstIdx = headers.findIndex((h) => ["prenom", "firstname"].some((k) => norm(h).includes(k)));
  const lastIdx = headers.findIndex((h) => { const n = norm(h); return (n === "nom" || n.startsWith("nom ")) && !n.includes("numero"); });
  const companyIdx = headers.findIndex((h) => ["societe", "company", "entreprise"].some((k) => norm(h).includes(k)));
  const get = (vals: string[], i: number) => (i >= 0 ? vals[i]?.trim() ?? "" : "");
  const rows: ImportRow[] = lines.slice(1).map((line) => {
    const v = parseLine(line, delim);
    const parts = [get(v, firstIdx), get(v, lastIdx)].filter(Boolean);
    return { phoneNumber: get(v, phoneIdx), contactName: parts.join(" ") || undefined, company: get(v, companyIdx) || undefined };
  });
  return { rows };
}

// ─── Shared atoms ─────────────────────────────────────────────────────────────

function LegalCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 cursor-pointer hover:bg-amber-100/60 transition-colors">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-amber-300 accent-red-600 shrink-0" />
      <span className="text-xs text-amber-800">
        Je déclare disposer d&apos;une base légale (intérêt légitime ou consentement) pour traiter ces données conformément au RGPD.
      </span>
    </label>
  );
}

function SuccessPanel({ imported, skipped, message, onClose }: { imported: number; skipped: number; message: string; onClose: () => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-green-50 border border-green-200 px-5 py-4 flex items-start gap-3">
        <span className="text-xl">✅</span>
        <div>
          <p className="font-semibold text-green-800">Import réussi</p>
          <p className="text-sm text-green-700 mt-0.5">{message}</p>
        </div>
      </div>
      <button onClick={onClose} className="w-full rounded-xl bg-gray-900 py-2.5 text-sm font-bold text-white hover:bg-gray-800 transition-colors">
        Fermer
      </button>
    </div>
  );
}

// ─── CSV tab ──────────────────────────────────────────────────────────────────

function CsvTab({ onImport, isPending }: { onImport: (rows: ImportRow[], name: string) => void; isPending: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [legalOk, setLegalOk] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name.replace(/\.csv$/i, ""));
    setParseError(null);
    setRows([]);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { rows: parsed, error } = csvToRows(ev.target?.result as string);
      if (error) setParseError(error); else setRows(parsed);
    };
    reader.readAsText(file, "UTF-8");
  }

  const preview = rows.slice(0, 6);
  return (
    <div className="space-y-4">
      <div onClick={() => fileRef.current?.click()}
        className="group flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 py-8 cursor-pointer hover:border-red-300 hover:bg-red-50/30 transition-all">
        <div className="h-10 w-10 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center group-hover:border-red-200 transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-700 group-hover:text-red-700 transition-colors">
            {rows.length > 0 ? `${fileName} — ${rows.length} ligne${rows.length !== 1 ? "s" : ""}` : "Choisir un fichier CSV"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{rows.length > 0 ? "Cliquer pour changer" : "Export Excel ou Google Sheets (.csv)"}</p>
        </div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
      </div>

      <div className="flex justify-between items-center">
        <p className="text-xs text-gray-400">Colonnes : <span className="text-gray-600 font-medium">Téléphone</span> (obligatoire), Prénom, Nom, Société</p>
        <a href="/sample-import.csv" download className="text-xs text-red-600 hover:underline font-medium">↓ Exemple</a>
      </div>

      {parseError && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{parseError}</div>}

      {preview.length > 0 && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-100 px-4 py-2 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Aperçu</p>
            <span className="text-[10px] text-gray-400">{rows.length} ligne{rows.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="divide-y divide-gray-50 max-h-36 overflow-y-auto">
            {preview.map((r, i) => (
              <div key={i} className="px-4 py-2 flex items-center gap-3">
                <code className="text-xs font-mono text-gray-700 w-32 shrink-0">{r.phoneNumber}</code>
                <span className="text-xs text-gray-500 truncate">{[r.contactName, r.company].filter(Boolean).join(" · ") || "—"}</span>
              </div>
            ))}
            {rows.length > 6 && <div className="px-4 py-2 text-xs text-gray-400">+ {rows.length - 6} autres</div>}
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <LegalCheckbox checked={legalOk} onChange={setLegalOk} />
          <button onClick={() => onImport(rows, fileName || "Import CSV")} disabled={!legalOk || isPending}
            className="w-full rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
            {isPending ? "Import…" : `Importer ${rows.length} prospect${rows.length !== 1 ? "s" : ""}`}
          </button>
        </>
      )}
    </div>
  );
}

// ─── Manual tab ───────────────────────────────────────────────────────────────

function ManualTab({ onImport, isPending, companies }: { onImport: (rows: ImportRow[], name: string) => void; isPending: boolean; companies: string[] }) {
  const [form, setForm] = useState({ phoneNumber: "", company: "", contactName: "" });
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [legalOk, setLegalOk] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const inputClass = "w-full rounded-xl border border-gray-200 px-3.5 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-100 transition-all";

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  function addRow() {
    if (!form.phoneNumber.trim()) { setFormError("Le numéro de téléphone est obligatoire."); return; }
    setFormError(null);
    setRows((r) => [...r, { phoneNumber: form.phoneNumber.trim(), company: form.company.trim() || undefined, contactName: form.contactName.trim() || undefined }]);
    setForm({ phoneNumber: "", company: "", contactName: "" });
  }

  return (
    <div className="space-y-4">
      {/* Datalist for company suggestions */}
      <datalist id="company-suggestions">
        {companies.map((c) => <option key={c} value={c} />)}
      </datalist>

      <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Téléphone <span className="text-red-500">*</span>
            </label>
            <input value={form.phoneNumber} onChange={set("phoneNumber")} placeholder="+33612345678"
              className={`${inputClass} font-mono`} list=""
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRow())} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Société</label>
            <input value={form.company} onChange={set("company")} placeholder="Acme Corp"
              className={inputClass} list="company-suggestions"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRow())} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Nom du contact</label>
            <input value={form.contactName} onChange={set("contactName")} placeholder="Jean Dupont"
              className={inputClass}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRow())} />
          </div>
        </div>
        {formError && <p className="text-xs text-red-600">{formError}</p>}
        <button type="button" onClick={addRow}
          className="w-full rounded-xl border-2 border-dashed border-gray-200 py-2 text-sm font-semibold text-gray-500 hover:border-red-300 hover:text-red-600 hover:bg-red-50/30 transition-all">
          + Ajouter ce contact
        </button>
      </div>

      {rows.length > 0 && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-100 px-4 py-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{rows.length} contact{rows.length !== 1 ? "s" : ""} à importer</p>
          </div>
          <div className="divide-y divide-gray-50 max-h-40 overflow-y-auto">
            {rows.map((r, i) => (
              <div key={i} className="px-4 py-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <code className="text-xs font-mono text-gray-700 shrink-0">{r.phoneNumber}</code>
                  <span className="text-xs text-gray-500 truncate">{[r.contactName, r.company].filter(Boolean).join(" · ") || "—"}</span>
                </div>
                <button onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                  className="text-gray-300 hover:text-red-500 transition-colors shrink-0 text-lg leading-none">×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <LegalCheckbox checked={legalOk} onChange={setLegalOk} />
          <button onClick={() => onImport(rows, "Ajout manuel")} disabled={!legalOk || isPending}
            className="w-full rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
            {isPending ? "Import…" : `Importer ${rows.length} contact${rows.length !== 1 ? "s" : ""}`}
          </button>
        </>
      )}
    </div>
  );
}

// ─── List selector ────────────────────────────────────────────────────────────

interface ListOption { id: string; name: string }

function ListSelector({
  lists,
  value,
  newName,
  onChangeValue,
  onChangeNewName,
}: {
  lists: ListOption[];
  value: string; // "" = new list, else list id
  newName: string;
  onChangeValue: (v: string) => void;
  onChangeNewName: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Destination</label>
      <select
        value={value}
        onChange={(e) => onChangeValue(e.target.value)}
        className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-100 bg-white transition-all"
      >
        <option value="">— Créer une nouvelle liste —</option>
        {lists.map((l) => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </select>
      {value === "" && (
        <input
          value={newName}
          onChange={(e) => onChangeNewName(e.target.value)}
          placeholder="Nom de la liste…"
          className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-100 transition-all"
        />
      )}
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function ImportModal({
  onClose,
  companies = [],
  lists = [],
}: {
  onClose: () => void;
  companies?: string[];
  lists?: ListOption[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"csv" | "manual">("csv");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ imported: number; skipped: number; message: string } | null>(null);
  const [listTarget, setListTarget] = useState<string>(lists[0]?.id ?? "");
  const [newListName, setNewListName] = useState("");

  function handleImport(rows: ImportRow[], fallbackName: string) {
    startTransition(async () => {
      let res: { imported: number; skipped: number; message: string };
      if (listTarget) {
        res = await importIntoList(rows, listTarget);
      } else {
        res = await importProspects(rows, newListName.trim() || fallbackName);
      }
      setResult(res);
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-bold text-gray-900">Importer des prospects</h2>
            <p className="text-xs text-gray-400 mt-0.5">CSV ou saisie manuelle</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors text-lg">×</button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-4">
          {result ? (
            <SuccessPanel {...result} onClose={onClose} />
          ) : (
            <>
              {/* List selector */}
              <ListSelector
                lists={lists}
                value={listTarget}
                newName={newListName}
                onChangeValue={setListTarget}
                onChangeNewName={setNewListName}
              />

              {/* Tab switch */}
              <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
                {(["csv", "manual"] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                    {t === "csv" ? "📄 CSV" : "✏️ Manuel"}
                  </button>
                ))}
              </div>

              {tab === "csv"
                ? <CsvTab onImport={handleImport} isPending={isPending} />
                : <ManualTab onImport={handleImport} isPending={isPending} companies={companies} />}

              {/* Cancel */}
              <button onClick={onClose} className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Annuler
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
