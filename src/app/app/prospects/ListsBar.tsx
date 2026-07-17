"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { createProspectList, renameProspectList, deleteProspectList } from "./actions";

interface ProspectListItem {
  id: string;
  name: string;
  importedAt: Date | string;
  _count: { prospects: number };
}

interface Props {
  lists: ProspectListItem[];
  activeListId: string | null;
  totalCount: number;
  onSelect: (listId: string | null) => void;
}

export default function ListsBar({ lists, activeListId, totalCount, onSelect }: Props) {
  const [isPending, start] = useTransition();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const createRef = useRef<HTMLInputElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (creating) createRef.current?.focus(); }, [creating]);
  useEffect(() => { if (renamingId) renameRef.current?.focus(); }, [renamingId]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuId) return;
    const handler = () => setMenuId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [menuId]);

  function handleCreate() {
    if (!newName.trim()) { setCreating(false); return; }
    start(async () => {
      await createProspectList(newName.trim(), "legitimate_interest");
      setNewName("");
      setCreating(false);
    });
  }

  function handleRename(id: string) {
    if (!renameValue.trim()) { setRenamingId(null); return; }
    start(async () => {
      await renameProspectList(id, renameValue.trim());
      setRenamingId(null);
      setMenuId(null);
    });
  }

  function handleDelete(id: string) {
    start(async () => {
      await deleteProspectList(id);
      setConfirmDeleteId(null);
      setMenuId(null);
      if (activeListId === id) onSelect(null);
    });
  }

  return (
    <div className="space-y-3">
      {/* Confirm delete modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setConfirmDeleteId(null)} />
          <div className="relative rounded-2xl bg-white shadow-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-bold text-gray-900">Supprimer cette liste ?</h3>
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              Tous les prospects de cette liste seront <strong>définitivement supprimés</strong>. Cette action est irréversible.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDeleteId(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
              <button onClick={() => handleDelete(confirmDeleteId)} disabled={isPending}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
                {isPending ? "…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* "Toutes" chip */}
        <button
          onClick={() => onSelect(null)}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            activeListId === null
              ? "bg-gray-900 text-white shadow-sm"
              : "border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900"
          }`}
        >
          Toutes
          <span className={`ml-2 text-xs font-normal ${activeListId === null ? "text-gray-300" : "text-gray-400"}`}>
            {totalCount}
          </span>
        </button>

        {/* List chips */}
        {lists.map((list) => {
          const isActive = activeListId === list.id;
          const isRenaming = renamingId === list.id;

          return (
            <div key={list.id} className="relative flex items-center group">
              {isRenaming ? (
                <input
                  ref={renameRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename(list.id);
                    if (e.key === "Escape") { setRenamingId(null); setMenuId(null); }
                  }}
                  onBlur={() => handleRename(list.id)}
                  className="rounded-xl border border-red-300 bg-white px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-red-200 w-36"
                />
              ) : (
                <button
                  onClick={() => onSelect(list.id)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all pr-7 ${
                    isActive
                      ? "bg-red-600 text-white shadow-sm"
                      : "border border-gray-200 bg-white text-gray-600 hover:border-red-200 hover:text-red-700"
                  }`}
                >
                  {list.name}
                  <span className={`ml-2 text-xs font-normal ${isActive ? "text-red-200" : "text-gray-400"}`}>
                    {list._count.prospects}
                  </span>
                </button>
              )}

              {/* "..." menu button */}
              {!isRenaming && (
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuId(menuId === list.id ? null : list.id); }}
                  className={`absolute right-1.5 h-5 w-5 rounded-md flex items-center justify-center text-[11px] transition-all ${
                    isActive
                      ? "text-red-200 hover:text-white hover:bg-red-500"
                      : "text-gray-300 hover:text-gray-600 hover:bg-gray-100 opacity-0 group-hover:opacity-100"
                  }`}
                >
                  ···
                </button>
              )}

              {/* Dropdown menu */}
              {menuId === list.id && (
                <div
                  className="absolute top-full left-0 mt-1.5 z-30 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden min-w-[140px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => { setRenamingId(list.id); setRenameValue(list.name); setMenuId(null); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <span className="text-gray-400">✎</span> Renommer
                  </button>
                  <button
                    onClick={() => { setConfirmDeleteId(list.id); setMenuId(null); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-gray-100"
                  >
                    <span>🗑</span> Supprimer
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Create new list */}
        {creating ? (
          <div className="flex items-center gap-1.5">
            <input
              ref={createRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") { setCreating(false); setNewName(""); }
              }}
              onBlur={handleCreate}
              placeholder="Nom de la liste…"
              className="rounded-xl border border-red-300 bg-white px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-red-200 w-44"
            />
            <span className="text-xs text-gray-400">↵ pour créer</span>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            disabled={isPending}
            className="rounded-xl border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-400 hover:border-red-300 hover:text-red-600 hover:bg-red-50/30 transition-all flex items-center gap-1.5"
          >
            <span className="text-base leading-none">+</span> Nouvelle liste
          </button>
        )}
      </div>
    </div>
  );
}
