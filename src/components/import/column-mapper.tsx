// @ts-nocheck — pending rewrite (schema migration lot 2)
"use client";

import type { ColumnMapping } from "@/lib/csv/parser";

const FIELDS: { key: keyof ColumnMapping; label: string; required: boolean }[] = [
  { key: "firstName", label: "Prénom", required: true },
  { key: "lastName", label: "Nom", required: true },
  { key: "phone", label: "Téléphone", required: true },
  { key: "email", label: "Email", required: false },
  { key: "company", label: "Société", required: false },
];

export function ColumnMapper({
  headers,
  mapping,
  onChange,
}: {
  headers: string[];
  mapping: Partial<ColumnMapping>;
  onChange: (m: Partial<ColumnMapping>) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700">
        Associez les colonnes de votre CSV aux champs KoldKol :
      </p>
      {FIELDS.map((field) => (
        <div key={field.key} className="flex items-center gap-3">
          <label className="w-32 text-sm text-gray-600 shrink-0">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <select
            value={mapping[field.key] ?? ""}
            onChange={(e) => onChange({ ...mapping, [field.key]: e.target.value || undefined })}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          >
            <option value="">— Ignorer —</option>
            {headers.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
