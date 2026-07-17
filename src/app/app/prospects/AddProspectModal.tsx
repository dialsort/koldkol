"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { addProspect } from "./actions";

interface ListOption { id: string; name: string }

interface Props {
  lists: ListOption[];
  onClose: () => void;
}

export default function AddProspectModal({ lists, onClose }: Props) {
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [contactName, setContactName] = useState("");
  const [listId, setListId] = useState(lists[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const phoneRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (mounted) phoneRef.current?.focus();
  }, [mounted]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!listId) { setError("Sélectionnez une liste"); return; }
    setLoading(true);
    setError(null);
    const result = await addProspect({ phoneNumber: phone, company, contactName, listId });
    setLoading(false);
    if (!result.ok) { setError(result.error ?? "Erreur inconnue"); return; }
    onClose();
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-end justify-center pb-24 px-4"
      style={{ zIndex: 9999 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Card */}
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-200">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Ajouter un prospect</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Fermer">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Téléphone <span className="text-red-500">*</span>
            </label>
            <input
              ref={phoneRef}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+33 6 12 34 56 78"
              required
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Entreprise</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Acme Corp"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom du contact</label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Jean Dupont"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Liste <span className="text-red-500">*</span>
            </label>
            {lists.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Aucune liste — importez d&apos;abord une liste.</p>
            ) : (
              <select
                value={listId}
                onChange={(e) => setListId(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-200 bg-white"
              >
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || lists.length === 0}
              className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Ajout…" : "Ajouter"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
