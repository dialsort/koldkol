"use client";

import { useState, useMemo, useTransition, useRef } from "react";
import Link from "next/link";
import type { CallResult, DispositionBehavior, Slot } from "@/types";
import {
  deleteProspects,
  setProspectsStatus,
  bulkAddTag,
  bulkRemoveTag,
  moveProspectsToList,
} from "./actions";
import ProspectDrawer from "./ProspectDrawer";
import ListsBar from "./ListsBar";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Tag { id: string; name: string; color: string }
interface ProspectRow {
  id: string;
  company: string | null;
  contactName: string | null;
  phoneNumber: string;
  status: "ACTIVE" | "EXCLUDED";
  listId: string | null;
  createdAt: Date | string;
  tags: { tag: Tag }[];
  slotStats: { attempts: number; humanAnswers: number }[];
  callAttempts: {
    id: string; startedAt: Date | string; slot: Slot; result: CallResult | null;
    disposition: { id: string; label: string; behavior: DispositionBehavior } | null;
  }[];
}
interface ListItem { id: string; name: string; importedAt: Date | string; _count: { prospects: number } }
interface Props {
  prospects: ProspectRow[];
  allTags: Tag[];
  allDispositions: { id: string; label: string; behavior: DispositionBehavior }[];
  lists: ListItem[];
  companies: string[];
}

const RESULT_LABEL: Record<CallResult, string> = {
  HUMAN_ANSWERED: "Décroché", ANSWERED_NOT_TAKEN: "Non pris",
  VOICEMAIL: "Échec (répondeur)", NO_ANSWER: "Pas de réponse",
  INVALID_NUMBER: "Numéro invalide", FAILED: "Échec",
};

function score(p: ProspectRow) {
  const a = p.slotStats.reduce((s, r) => s + r.attempts, 0);
  const h = p.slotStats.reduce((s, r) => s + r.humanAnswers, 0);
  return a === 0 ? -1 : h / a;
}

// ─── Bulk action bar ──────────────────────────────────────────────────────────

function BulkBar({
  selected, allTags, lists, onClear,
}: {
  selected: string[]; allTags: Tag[]; lists: ListItem[]; onClear: () => void;
}) {
  const [isPending, start] = useTransition();
  const [tagMenu, setTagMenu] = useState<"add" | "remove" | null>(null);
  const [moveMenu, setMoveMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  function run(fn: () => Promise<void>) {
    start(async () => { await fn(); onClear(); });
  }

  if (confirmDelete) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
        <p className="text-sm text-red-700 font-medium flex-1">
          Supprimer {selected.length} prospect{selected.length !== 1 ? "s" : ""} définitivement ?
        </p>
        <button onClick={() => setConfirmDelete(false)} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">Annuler</button>
        <button onClick={() => run(() => deleteProspects(selected))} disabled={isPending}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50">
          {isPending ? "…" : "Confirmer"}
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
      <span className="text-sm font-semibold text-gray-700 mr-1">
        {selected.length} sélectionné{selected.length !== 1 ? "s" : ""}
      </span>

      {/* Tag actions */}
      <div className="relative" ref={menuRef}>
        <button onClick={() => setTagMenu(tagMenu ? null : "add")}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 transition-colors">
          + Tag ▾
        </button>
        {tagMenu && (
          <div className="absolute top-full left-0 mt-1.5 z-20 rounded-xl border border-gray-200 bg-white shadow-lg p-1 min-w-[180px]">
            <div className="flex gap-1 p-1 mb-1">
              {(["add", "remove"] as const).map((m) => (
                <button key={m} onClick={() => setTagMenu(m)}
                  className={`flex-1 rounded-lg py-1 text-xs font-semibold transition-colors ${tagMenu === m ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
                  {m === "add" ? "Ajouter" : "Retirer"}
                </button>
              ))}
            </div>
            {allTags.length === 0 && <p className="px-3 py-2 text-xs text-gray-400">Aucun tag créé</p>}
            {allTags.map((tag) => (
              <button key={tag.id}
                onClick={() => { run(() => tagMenu === "add" ? bulkAddTag(selected, tag.id) : bulkRemoveTag(selected, tag.id)); setTagMenu(null); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-gray-50 rounded-lg transition-colors">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                {tag.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Move to list */}
      {lists.length > 0 && (
        <div className="relative">
          <button onClick={() => setMoveMenu((v) => !v)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 transition-colors">
            Déplacer ▾
          </button>
          {moveMenu && (
            <div className="absolute top-full left-0 mt-1.5 z-20 rounded-xl border border-gray-200 bg-white shadow-lg p-1 min-w-[180px]">
              {lists.map((list) => (
                <button key={list.id}
                  onClick={() => { run(() => moveProspectsToList(selected, list.id)); setMoveMenu(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
                  <span className="h-2 w-2 rounded-full bg-red-400 shrink-0" />
                  {list.name}
                  <span className="ml-auto text-xs text-gray-400">{list._count.prospects}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Status */}
      <button onClick={() => run(() => setProspectsStatus(selected, "ACTIVE"))} disabled={isPending}
        className="rounded-lg border border-green-200 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50 transition-colors">
        Activer
      </button>
      <button onClick={() => run(() => setProspectsStatus(selected, "EXCLUDED"))} disabled={isPending}
        className="rounded-lg border border-orange-200 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-50 disabled:opacity-50 transition-colors">
        Exclure
      </button>

      <div className="flex-1" />

      <button onClick={() => setConfirmDelete(true)} disabled={isPending}
        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors">
        Supprimer
      </button>
      <button onClick={onClear} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors">Désélectionner</button>
    </div>
  );
}

// ─── Main list ────────────────────────────────────────────────────────────────

export default function ProspectList({ prospects, allTags, allDispositions, lists, companies }: Props) {
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | "ACTIVE" | "EXCLUDED">("");
  const [filterDisposition, setFilterDisposition] = useState("");
  const [filterListId, setFilterListId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<"createdAt" | "score">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerProspect, setDrawerProspect] = useState<{ id: string; name: string } | null>(null);

  const totalCount = prospects.length;

  const filtered = useMemo(() => {
    let rows = prospects;
    if (filterListId) rows = rows.filter((p) => p.listId === filterListId);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((p) => (p.company ?? "").toLowerCase().includes(q) || (p.contactName ?? "").toLowerCase().includes(q) || p.phoneNumber.includes(q));
    }
    if (filterTag) rows = rows.filter((p) => p.tags.some((t) => t.tag.id === filterTag));
    if (filterStatus) rows = rows.filter((p) => p.status === filterStatus);
    if (filterDisposition) rows = rows.filter((p) => p.callAttempts[0]?.disposition?.id === filterDisposition);
    return [...rows].sort((a, b) => {
      const cmp = sortKey === "score" ? score(a) - score(b) : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [prospects, filterListId, search, filterTag, filterStatus, filterDisposition, sortKey, sortDir]);

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const allFilteredIds = filtered.map((p) => p.id);
  const allChecked = allFilteredIds.length > 0 && allFilteredIds.every((id) => selected.has(id));
  const someChecked = allFilteredIds.some((id) => selected.has(id));

  function toggleAll() {
    setSelected((s) => {
      const n = new Set(s);
      if (allChecked) allFilteredIds.forEach((id) => n.delete(id));
      else allFilteredIds.forEach((id) => n.add(id));
      return n;
    });
  }

  function toggleRow(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const selectedArr = [...selected];

  return (
    <div className="space-y-3">
      {/* Lists bar */}
      {lists.length > 0 && (
        <ListsBar
          lists={lists}
          activeListId={filterListId}
          totalCount={totalCount}
          onSelect={(id) => { setFilterListId(id); setSelected(new Set()); }}
        />
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…"
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none bg-white" />
        <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none bg-white">
          <option value="">Tous les tags</option>
          {allTags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none bg-white">
          <option value="">Tous les statuts</option>
          <option value="ACTIVE">Actif</option>
          <option value="EXCLUDED">Exclu</option>
        </select>
        <select value={filterDisposition} onChange={(e) => setFilterDisposition(e.target.value)}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none bg-white">
          <option value="">Toutes les dispositions</option>
          {allDispositions.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
        {(search || filterTag || filterStatus || filterDisposition) && (
          <button onClick={() => { setSearch(""); setFilterTag(""); setFilterStatus(""); setFilterDisposition(""); }}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 bg-white">
            Effacer
          </button>
        )}
      </div>

      {/* Bulk bar */}
      {selectedArr.length > 0 && (
        <BulkBar selected={selectedArr} allTags={allTags} lists={lists} onClear={() => setSelected(new Set())} />
      )}

      {/* Table */}
      <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="w-10 px-4 py-3">
                <input type="checkbox" checked={allChecked} ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }}
                  onChange={toggleAll} className="h-4 w-4 rounded border-gray-300 accent-red-600 cursor-pointer" />
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Prospect</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Téléphone</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Tags</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Statut</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Dernier appel</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none" onClick={() => toggleSort("score")}>
                Score {sortKey === "score" ? (sortDir === "desc" ? "↓" : "↑") : ""}
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Aucun résultat</td></tr>
            )}
            {filtered.map((p) => {
              const s = score(p);
              const last = p.callAttempts[0];
              const isSelected = selected.has(p.id);
              return (
                <tr key={p.id}
                  className={`transition-colors ${isSelected ? "bg-red-50/60" : "hover:bg-gray-50"}`}>
                  {/* Checkbox */}
                  <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleRow(p.id)}
                      className="h-4 w-4 rounded border-gray-300 accent-red-600 cursor-pointer" />
                  </td>
                  {/* Name — click to open drawer */}
                  <td className="px-4 py-3 font-medium text-gray-900 cursor-pointer" onClick={() => setDrawerProspect({ id: p.id, name: p.company ?? p.contactName ?? p.phoneNumber })}>
                    <span className="hover:text-red-700 transition-colors">
                      {p.company ?? p.contactName ?? "—"}
                    </span>
                    {p.company && p.contactName && (
                      <span className="block text-xs text-gray-400">{p.contactName}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-600">{p.phoneNumber}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.tags.map(({ tag }) => (
                        <span key={tag.id} className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ backgroundColor: tag.color }}>
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${p.status === "EXCLUDED" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                      {p.status === "EXCLUDED" ? "Exclu" : "Actif"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {last ? (
                      <div>
                        <span>{last.result ? RESULT_LABEL[last.result] : "—"}</span>
                        {last.disposition && <span className="block text-xs text-gray-400">{last.disposition.label}</span>}
                      </div>
                    ) : <span className="text-gray-300">Jamais appelé</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {s < 0 ? <span className="text-gray-300 text-xs">—</span> : <span className="text-sm font-medium text-gray-700">{(s * 100).toFixed(0)}%</span>}
                  </td>
                  <td className="px-4 py-3 flex items-center gap-2">
                    <button onClick={() => setDrawerProspect({ id: p.id, name: p.company ?? p.contactName ?? p.phoneNumber })}
                      className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-500 hover:border-red-200 hover:text-red-600 hover:bg-red-50/40 transition-all">
                      Modifier
                    </button>
                    <Link href={`/app/prospects/${p.id}`}
                      className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100 transition-colors">
                      Fiche →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        {filtered.length} prospect{filtered.length !== 1 ? "s" : ""} affiché{filtered.length !== 1 ? "s" : ""}
        {selectedArr.length > 0 && ` · ${selectedArr.length} sélectionné${selectedArr.length !== 1 ? "s" : ""}`}
      </p>

      {/* Prospect drawer */}
      {drawerProspect && (
        <ProspectDrawer
          prospectId={drawerProspect.id}
          initialName={drawerProspect.name}
          allTags={allTags}
          companies={companies}
          onClose={() => setDrawerProspect(null)}
        />
      )}
    </div>
  );
}
