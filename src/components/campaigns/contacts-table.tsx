// @ts-nocheck — pending rewrite (schema migration lot 2)
"use client";

import { useEffect, useState, useCallback } from "react";
import type { Contact, ContactStatus } from "@/types";
import { StatusBadge } from "@/components/ui/badge";
import { formatPhone, formatHour } from "@/lib/utils";

const FILTERS: { label: string; value: string }[] = [
  { label: "Tous", value: "" },
  { label: "Joignables", value: "REACHABLE" },
  { label: "Injoignables", value: "UNREACHABLE" },
  { label: "En attente", value: "PENDING" },
  { label: "Faux numéros", value: "INVALID" },
  { label: "En appel", value: "CALLING" },
];

export function ContactsTable({ campaignId }: { campaignId: string }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchContacts = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      limit: "50",
      ...(filter && { status: filter }),
    });
    const res = await fetch(`/api/campaigns/${campaignId}/contacts?${params}`);
    if (!res.ok) return;
    const data = await res.json();
    setContacts(data.contacts);
    setTotal(data.total);
    setLoading(false);
  }, [campaignId, filter, page]);

  useEffect(() => {
    fetchContacts();
    const interval = setInterval(fetchContacts, 5000);
    return () => clearInterval(interval);
  }, [fetchContacts]);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              filter === f.value
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-sm text-gray-500 self-center">
          {total} contact{total > 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Contact</th>
              <th className="px-4 py-3 text-left">Téléphone</th>
              <th className="px-4 py-3 text-left">Société</th>
              <th className="px-4 py-3 text-left">Statut</th>
              <th className="px-4 py-3 text-left">Meilleure heure</th>
              <th className="px-4 py-3 text-center">Tentatives</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Chargement…
                </td>
              </tr>
            ) : contacts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Aucun contact trouvé
                </td>
              </tr>
            ) : (
              contacts.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {c.firstName} {c.lastName}
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                    {formatPhone(c.phone)}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.company ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status as ContactStatus} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {c.bestHour != null ? (
                      <span className="font-medium text-blue-600">🕐 {formatHour(c.bestHour)}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">{c.attemptCount}/5</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40"
          >
            ← Préc.
          </button>
          <span className="text-sm text-gray-500">
            Page {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40"
          >
            Suiv. →
          </button>
        </div>
      )}
    </div>
  );
}
