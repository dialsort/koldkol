// @ts-nocheck — pending rewrite (schema migration lot 2)
import Papa from "papaparse";

export type RawRow = Record<string, string>;

export type ParseResult = {
  rows: RawRow[];
  headers: string[];
  errors: string[];
};

export function parseCSV(content: string): ParseResult {
  const result = Papa.parse<RawRow>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  });

  const errors = result.errors.map((e) => `Ligne ${(e.row ?? 0) + 2}: ${e.message}`);

  return {
    rows: result.data,
    headers: result.meta.fields ?? [],
    errors,
  };
}

export type ColumnMapping = {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  company?: string;
};

export type MappedContact = {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  company?: string;
};

export function applyMapping(rows: RawRow[], mapping: ColumnMapping): MappedContact[] {
  return rows.map((row) => ({
    firstName: row[mapping.firstName] ?? "",
    lastName: row[mapping.lastName] ?? "",
    phone: row[mapping.phone] ?? "",
    email: mapping.email ? row[mapping.email] : undefined,
    company: mapping.company ? row[mapping.company] : undefined,
  }));
}
