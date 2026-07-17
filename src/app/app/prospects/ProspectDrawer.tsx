"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import type { CallResult, DispositionBehavior, Slot } from "@/types";
import {
  getProspectFull,
  updateProspect,
  setProspectTags,
  addNote,
  excludeProspect,
  reactivateProspect,
  deleteProspects,
} from "./actions";

type FullProspect = NonNullable<Awaited<ReturnType<typeof getProspectFull>>>;
interface Tag { id: string; name: string; color: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RESULT_LABEL: Record<CallResult, string> = {
  HUMAN_ANSWERED: "Décroché", ANSWERED_NOT_TAKEN: "Non pris",
  VOICEMAIL: "Échec (répondeur)", NO_ANSWER: "Pas de réponse",
  INVALID_NUMBER: "Numéro invalide", FAILED: "Échec",
};
const RESULT_COLOR: Record<CallResult, string> = {
  HUMAN_ANSWERED: "text-green-600", ANSWERED_NOT_TAKEN: "text-orange-500",
  VOICEMAIL: "text-blue-500", NO_ANSWER: "text-gray-400",
  INVALID_NUMBER: "text-red-600", FAILED: "text-red-500",
};
const SLOT_LABEL: Record<Slot, string> = { MATIN: "Matin", DEBUT_APREM: "Début AM", FIN_APREM: "Fin AM" };

function fmt(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}
function fmtDuration(s: number | null) {
  if (!s) return null;
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}min${s % 60 ? ` ${s % 60}s` : ""}`;
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{title}</h3>
      {children}
    </div>
  );
}

// ─── Infos tab ────────────────────────────────────────────────────────────────

function InfosTab({
  prospect, allTags, companies, onRefresh,
}: {
  prospect: FullProspect; allTags: Tag[]; companies: string[]; onRefresh: () => void;
}) {
  const [isPending, start] = useTransition();
  const [form, setForm] = useState({
    company: prospect.company ?? "",
    contactName: prospect.contactName ?? "",
    phoneNumber: prospect.phoneNumber,
  });
  const [tagIds, setTagIds] = useState(new Set(prospect.tags.map((t) => t.tag.id)));
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmExclude, setConfirmExclude] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [k]: e.target.value }));
      setDirty(true);
      setSaved(false);
    };
  }
  function toggleTag(id: string) {
    setTagIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
    setDirty(true);
    setSaved(false);
  }

  function handleSave() {
    setError(null);
    start(async () => {
      try {
        await updateProspect(prospect.id, {
          company: form.company.trim() || null,
          contactName: form.contactName.trim() || null,
          phoneNumber: form.phoneNumber.trim(),
        });
        await setProspectTags(prospect.id, [...tagIds]);
        setDirty(false);
        setSaved(true);
        onRefresh();
      } catch { setError("Erreur lors de la sauvegarde."); }
    });
  }

  const inputClass = "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-100 transition-all";

  return (
    <div className="space-y-6">
      {/* Coordonnées */}
      <Section title="Coordonnées">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Société</label>
            <input value={form.company} onChange={set("company")} placeholder="Acme Corp"
              className={inputClass} list="drawer-company-list" />
            <datalist id="drawer-company-list">{companies.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Nom du contact</label>
            <input value={form.contactName} onChange={set("contactName")} placeholder="Jean Dupont" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Téléphone <span className="text-red-500">*</span></label>
            <input value={form.phoneNumber} onChange={set("phoneNumber")} placeholder="+33612345678"
              className={`${inputClass} font-mono`} />
          </div>
        </div>
      </Section>

      {/* Tags */}
      <Section title="Tags">
        <div className="flex flex-wrap gap-2">
          {allTags.map((tag) => {
            const active = tagIds.has(tag.id);
            return (
              <button key={tag.id} onClick={() => toggleTag(tag.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold border-2 transition-all ${active ? "text-white border-transparent" : "text-gray-500 border-gray-200 bg-white hover:border-gray-300"}`}
                style={active ? { backgroundColor: tag.color, borderColor: tag.color } : {}}>
                {active ? "✓ " : ""}{tag.name}
              </button>
            );
          })}
          {allTags.length === 0 && <p className="text-xs text-gray-400">Aucun tag créé</p>}
        </div>
      </Section>

      {/* Meta */}
      <Section title="Informations">
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Créé le</span>
            <span className="text-gray-700 font-medium">{fmtDate(prospect.createdAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Statut</span>
            <span className={`font-semibold ${prospect.status === "EXCLUDED" ? "text-red-600" : "text-green-600"}`}>
              {prospect.status === "EXCLUDED" ? "Exclu" : "Actif"}
            </span>
          </div>
          {prospect.excludedAt && (
            <div className="flex justify-between">
              <span className="text-gray-500">Exclu le</span>
              <span className="text-gray-700">{fmtDate(prospect.excludedAt)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">Liste source</span>
            <span className="text-gray-700">{prospect.list.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Base légale</span>
            <span className="text-gray-700">{prospect.list.legalBasis}</span>
          </div>
        </div>
      </Section>

      {/* Save bar */}
      {(dirty || saved || error) && (
        <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${saved ? "bg-green-50 border border-green-200" : "bg-white border border-gray-200"}`}>
          {saved
            ? <span className="text-sm text-green-700 font-medium flex-1">✓ Modifications enregistrées</span>
            : <span className="text-sm text-gray-500 flex-1">{error ?? "Modifications non sauvegardées"}</span>}
          {dirty && (
            <button onClick={handleSave} disabled={isPending || !form.phoneNumber.trim()}
              className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-bold text-white hover:bg-gray-800 disabled:opacity-50 transition-colors">
              {isPending ? "…" : "Enregistrer"}
            </button>
          )}
        </div>
      )}

      {/* Danger zone */}
      <Section title="Zone de danger">
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
          {prospect.status === "ACTIVE" ? (
            confirmExclude ? (
              <div className="space-y-2">
                <p className="text-sm text-orange-700 font-medium">Exclure définitivement ce prospect ?</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmExclude(false)} className="flex-1 rounded-lg border border-gray-200 py-2 text-xs text-gray-600 hover:bg-gray-50">Annuler</button>
                  <button onClick={() => { start(async () => { await excludeProspect(prospect.id); onRefresh(); }); setConfirmExclude(false); }} disabled={isPending}
                    className="flex-1 rounded-lg bg-orange-500 py-2 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-50">Confirmer</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmExclude(true)} className="w-full rounded-lg border border-orange-200 py-2 text-sm text-orange-600 hover:bg-orange-50 transition-colors">
                Exclure ce prospect
              </button>
            )
          ) : (
            <button onClick={() => { start(async () => { await reactivateProspect(prospect.id); onRefresh(); }); }} disabled={isPending}
              className="w-full rounded-lg border border-green-200 py-2 text-sm text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50">
              {isPending ? "…" : "Réactiver ce prospect"}
            </button>
          )}

          {confirmDelete ? (
            <div className="space-y-2 pt-1">
              <p className="text-sm text-red-700 font-medium">Supprimer définitivement ?</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)} className="flex-1 rounded-lg border border-gray-200 py-2 text-xs text-gray-600 hover:bg-gray-50">Annuler</button>
                <button onClick={() => start(async () => { await deleteProspects([prospect.id]); onRefresh(); })} disabled={isPending}
                  className="flex-1 rounded-lg bg-red-600 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50">Supprimer</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="w-full rounded-lg border border-red-200 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
              Supprimer ce prospect
            </button>
          )}
        </div>
      </Section>
    </div>
  );
}

// ─── Notes tab ────────────────────────────────────────────────────────────────

function NotesTab({ prospect, onRefresh }: { prospect: FullProspect; onRefresh: () => void }) {
  const [body, setBody] = useState("");
  const [isPending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!body.trim()) return;
    setError(null);
    start(async () => {
      try {
        await addNote(prospect.id, body);
        setBody("");
        onRefresh();
      } catch (e) { setError(e instanceof Error ? e.message : "Erreur"); }
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Ajouter une note…" rows={3}
          className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-red-400 focus:outline-none resize-none transition-all"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(); }} />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button onClick={handleSubmit} disabled={isPending || !body.trim()}
          className="rounded-xl bg-gray-900 px-4 py-2 text-xs font-bold text-white hover:bg-gray-800 disabled:opacity-40 transition-colors">
          {isPending ? "Envoi…" : "Ajouter la note"} <span className="text-gray-400 ml-1">⌘↵</span>
        </button>
      </div>

      <div className="space-y-2">
        {prospect.notes.length === 0 && <p className="text-xs text-gray-400 py-4 text-center">Aucune note</p>}
        {prospect.notes.map((n) => (
          <div key={n.id} className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{n.body}</p>
            <p className="mt-2 text-[10px] text-gray-400">{n.author.email} · {fmt(n.createdAt)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── History tab ──────────────────────────────────────────────────────────────

function HistoryTab({ prospect }: { prospect: FullProspect }) {
  if (prospect.callAttempts.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">Aucun appel enregistré</p>;
  }
  return (
    <div className="space-y-2">
      {prospect.callAttempts.map((a) => (
        <div key={a.id} className="rounded-xl border border-gray-100 bg-white px-4 py-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{fmt(a.startedAt)}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{SLOT_LABEL[a.slot]}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {a.result && (
              <span className={`text-sm font-semibold ${RESULT_COLOR[a.result]}`}>{RESULT_LABEL[a.result]}</span>
            )}
            {a.durationSec != null && fmtDuration(a.durationSec) && (
              <span className="text-xs text-gray-400">⏱ {fmtDuration(a.durationSec)}</span>
            )}
            {a.disposition && (
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">{a.disposition.label}</span>
            )}
          </div>
          {a.callbackAt && (
            <p className="text-xs text-orange-600">Rappel prévu : {fmt(a.callbackAt)}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main drawer ──────────────────────────────────────────────────────────────

interface Props {
  prospectId: string;
  initialName: string;
  allTags: Tag[];
  companies: string[];
  onClose: () => void;
}

export default function ProspectDrawer({ prospectId, initialName, allTags, companies, onClose }: Props) {
  const [tab, setTab] = useState<"infos" | "notes" | "historique">("infos");
  const [data, setData] = useState<FullProspect | null>(null);
  const [loading, setLoading] = useState(true);
  const [, startLoad] = useTransition();

  function load() {
    setLoading(true);
    startLoad(async () => {
      const full = await getProspectFull(prospectId);
      setData(full);
      setLoading(false);
    });
  }

  useEffect(() => { load(); }, [prospectId]);

  const TABS = [
    { id: "infos" as const, label: "Infos" },
    { id: "notes" as const, label: `Notes${data ? ` (${data.notes.length})` : ""}` },
    { id: "historique" as const, label: `Appels${data ? ` (${data.callAttempts.length})` : ""}` },
  ];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />

      {/* Drawer panel */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[480px] bg-[#f7f7f8] shadow-2xl flex flex-col"
        style={{ animation: "slideInRight 220ms cubic-bezier(0.16,1,0.3,1) both" }}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-gray-200 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-0.5">Prospect</p>
              <h2 className="text-lg font-bold text-gray-900 truncate">
                {data ? (data.company ?? data.contactName ?? data.phoneNumber) : initialName}
              </h2>
              {data?.company && data?.contactName && (
                <p className="text-sm text-gray-500 truncate">{data.contactName}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {data && (
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${data.status === "EXCLUDED" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                  {data.status === "EXCLUDED" ? "Exclu" : "Actif"}
                </span>
              )}
              <Link href={`/app/prospects/${prospectId}`}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 transition-colors">
                Fiche →
              </Link>
              <button onClick={onClose}
                className="h-8 w-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 text-lg transition-colors">×</button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 rounded-xl bg-gray-100 p-1">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="space-y-4 animate-pulse">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 rounded-xl bg-gray-200" />
              ))}
            </div>
          ) : data ? (
            <>
              {tab === "infos" && <InfosTab prospect={data} allTags={allTags} companies={companies} onRefresh={load} />}
              {tab === "notes" && <NotesTab prospect={data} onRefresh={load} />}
              {tab === "historique" && <HistoryTab prospect={data} />}
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-12">Prospect introuvable</p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0.8; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}
