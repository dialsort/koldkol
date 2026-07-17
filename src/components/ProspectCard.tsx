"use client";

import { useState, useTransition } from "react";
import {
  addNote,
  addTag,
  removeTag,
  excludeProspect,
  saveDisposition,
  createDisposition,
  updateDisposition,
  deleteDisposition,
} from "@/app/app/prospects/actions";
import type { CallResult, DispositionBehavior, Slot } from "@/types";

// ─── Domain types (shape of data passed to the card) ──────────────────────

export interface CardTag {
  id: string;
  name: string;
  color: string;
}
export interface CardNote {
  id: string;
  body: string;
  createdAt: string;
  author: { email: string };
}
export interface CardAttempt {
  id: string;
  startedAt: string;
  slot: Slot;
  result: CallResult | null;
  durationSec?: number | null;
  callbackAt?: string | null;
  disposition: { id: string; label: string; behavior: DispositionBehavior } | null;
}
export interface CardDisposition {
  id: string;
  label: string;
  behavior: DispositionBehavior;
  kind: string;
}
export interface ProspectCardData {
  id: string;
  company: string | null;
  contactName: string | null;
  phoneNumber: string;
  status: "ACTIVE" | "EXCLUDED";
  excludedAt?: string | null;
  list: { name: string; legalBasis: string };
  tags: { tag: CardTag }[];
  notes: CardNote[];
  callAttempts: CardAttempt[];
}

interface Props {
  prospect: ProspectCardData;
  allTags: CardTag[];
  dispositions: CardDisposition[];
  /** Pass the ID of the call in progress to enable disposition selection. */
  activeCallAttemptId?: string;
  /** Called after data changes so parent can refetch if needed. */
  onRefresh?: () => void;
}

// ─── Display helpers ───────────────────────────────────────────────────────

const SLOT_LABEL: Record<Slot, string> = {
  MATIN: "Matin",
  DEBUT_APREM: "Début AM",
  FIN_APREM: "Fin AM",
};

const RESULT_LABEL: Record<CallResult, string> = {
  HUMAN_ANSWERED: "Décroché",
  ANSWERED_NOT_TAKEN: "Décroché (non pris)",
  VOICEMAIL: "Échec (répondeur)",
  NO_ANSWER: "Pas de réponse",
  INVALID_NUMBER: "Numéro invalide",
  FAILED: "Échec",
};

const RESULT_COLOR: Record<CallResult, string> = {
  HUMAN_ANSWERED: "text-green-600",
  ANSWERED_NOT_TAKEN: "text-orange-500",
  VOICEMAIL: "text-blue-500",
  NO_ANSWER: "text-gray-400",
  INVALID_NUMBER: "text-red-600",
  FAILED: "text-red-500",
};

const BEHAVIOR_LABELS: Record<DispositionBehavior, string> = {
  NONE: "Neutre",
  DO_NOT_CALL: "Ne plus appeler",
  CALLBACK: "Rappel",
  VOICEMAIL: "Échec (répondeur)",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Tag Manager ──────────────────────────────────────────────────────────

function TagManager({
  prospectId,
  tags,
  allTags,
  onRefresh,
}: {
  prospectId: string;
  tags: { tag: CardTag }[];
  allTags: CardTag[];
  onRefresh?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);

  const presentIds = new Set(tags.map((t) => t.tag.id));
  const available = allTags.filter((t) => !presentIds.has(t.id));

  function handleAdd(tagId: string) {
    startTransition(async () => {
      await addTag(prospectId, tagId);
      setAdding(false);
      onRefresh?.();
    });
  }

  function handleRemove(tagId: string) {
    startTransition(async () => {
      await removeTag(prospectId, tagId);
      onRefresh?.();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map(({ tag }) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
          style={{ backgroundColor: tag.color }}
        >
          {tag.name}
          <button
            onClick={() => handleRemove(tag.id)}
            disabled={pending}
            className="opacity-70 hover:opacity-100 text-[10px] leading-none ml-0.5"
            aria-label="Retirer"
          >
            ×
          </button>
        </span>
      ))}
      {adding ? (
        <select
          autoFocus
          className="rounded border border-gray-300 px-1.5 py-0.5 text-xs"
          onChange={(e) => handleAdd(e.target.value)}
          onBlur={() => setAdding(false)}
          defaultValue=""
        >
          <option value="" disabled>
            Choisir…
          </option>
          {available.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      ) : available.length > 0 ? (
        <button
          onClick={() => setAdding(true)}
          className="rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-400 hover:border-gray-500 hover:text-gray-600"
        >
          + Tag
        </button>
      ) : null}
    </div>
  );
}

// ─── Note Block ───────────────────────────────────────────────────────────

function NoteBlock({
  prospectId,
  notes,
  onRefresh,
}: {
  prospectId: string;
  notes: CardNote[];
  onRefresh?: () => void;
}) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!body.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await addNote(prospectId, body);
        setBody("");
        onRefresh?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Ajouter une note…"
          rows={2}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={pending || !body.trim()}
          className="self-end rounded-lg bg-gray-800 px-3 py-2 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-40"
        >
          {pending ? "…" : "Envoyer"}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {notes.map((n) => (
          <div key={n.id} className="rounded-lg bg-gray-50 px-3 py-2">
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{n.body}</p>
            <p className="mt-1 text-[10px] text-gray-400">
              {n.author.email} · {fmt(n.createdAt)}
            </p>
          </div>
        ))}
        {notes.length === 0 && <p className="text-xs text-gray-400">Aucune note</p>}
      </div>
    </div>
  );
}

// ─── Disposition Selector ─────────────────────────────────────────────────

function DispositionSelector({
  prospectId,
  callAttemptId,
  dispositions,
  onRefresh,
}: {
  prospectId: string;
  callAttemptId: string;
  dispositions: CardDisposition[];
  onRefresh?: () => void;
}) {
  const [selected, setSelected] = useState("");
  const [callbackAt, setCallbackAt] = useState("");
  const [showDncModal, setShowDncModal] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const selectedDisp = dispositions.find((d) => d.id === selected);

  function handleSave(overrideDnc = false) {
    if (!selected) return;
    if (selectedDisp?.behavior === "DO_NOT_CALL" && !overrideDnc) {
      setShowDncModal(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await saveDisposition(callAttemptId, selected, callbackAt || undefined);
        if (selectedDisp?.behavior === "DO_NOT_CALL") {
          await excludeProspect(prospectId);
        }
        setSaved(true);
        onRefresh?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  if (saved) {
    return (
      <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
        Disposition enregistrée.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
        >
          <option value="">Choisir une disposition…</option>
          {dispositions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
              {d.behavior !== "NONE" ? ` · ${BEHAVIOR_LABELS[d.behavior]}` : ""}
            </option>
          ))}
        </select>

        {selectedDisp?.behavior === "CALLBACK" && (
          <input
            type="datetime-local"
            value={callbackAt}
            onChange={(e) => setCallbackAt(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
          />
        )}

        {selectedDisp?.behavior === "DO_NOT_CALL" && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            Cette disposition exclura définitivement le prospect.
          </div>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          onClick={() => handleSave()}
          disabled={pending || !selected || (selectedDisp?.behavior === "CALLBACK" && !callbackAt)}
          className="w-full rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
        >
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>

      {showDncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-2xl bg-white p-6 shadow-xl max-w-sm w-full mx-4 space-y-4">
            <h2 className="text-lg font-bold text-red-700">Confirmation requise</h2>
            <p className="text-sm text-gray-700">
              Cette action va exclure définitivement <strong>ce prospect</strong> de toute future
              campagne. Cette exclusion est permanente et irréversible.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowDncModal(false)}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  setShowDncModal(false);
                  handleSave(true);
                }}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Confirmer l'exclusion
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Disposition Manager (custom CRUD) ────────────────────────────────────

function DispositionManager({
  dispositions,
  onRefresh,
}: {
  dispositions: CardDisposition[];
  onRefresh?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newBehavior, setNewBehavior] = useState<DispositionBehavior>("NONE");
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editBehavior, setEditBehavior] = useState<DispositionBehavior>("NONE");
  const [pending, startTransition] = useTransition();

  function handleCreate() {
    if (!newLabel.trim()) return;
    startTransition(async () => {
      await createDisposition(newLabel, newBehavior);
      setNewLabel("");
      setNewBehavior("NONE");
      onRefresh?.();
    });
  }

  function handleUpdate(id: string) {
    startTransition(async () => {
      await updateDisposition(id, editLabel, editBehavior);
      setEditId(null);
      onRefresh?.();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteDisposition(id);
      onRefresh?.();
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-gray-400 underline hover:text-gray-600"
      >
        Gérer les dispositions
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="rounded-2xl bg-white shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-semibold text-gray-900">Dispositions personnalisées</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-96 overflow-y-auto">
              {dispositions.map((d) => (
                <div key={d.id} className="flex items-center gap-2">
                  {editId === d.id ? (
                    <>
                      <input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="flex-1 rounded border border-gray-200 px-2 py-1 text-sm"
                      />
                      <select
                        value={editBehavior}
                        onChange={(e) => setEditBehavior(e.target.value as DispositionBehavior)}
                        className="rounded border border-gray-200 px-2 py-1 text-sm"
                      >
                        {(["NONE", "CALLBACK", "VOICEMAIL"] as DispositionBehavior[]).map((b) => (
                          <option key={b} value={b}>
                            {BEHAVIOR_LABELS[b]}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleUpdate(d.id)}
                        disabled={pending}
                        className="text-xs text-green-600 hover:text-green-800"
                      >
                        Sauver
                      </button>
                      <button onClick={() => setEditId(null)} className="text-xs text-gray-400">
                        Annuler
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-gray-800">{d.label}</span>
                      <span className="text-xs text-gray-400">{BEHAVIOR_LABELS[d.behavior]}</span>
                      {d.kind === "CUSTOM" && (
                        <>
                          <button
                            onClick={() => {
                              setEditId(d.id);
                              setEditLabel(d.label);
                              setEditBehavior(d.behavior);
                            }}
                            className="text-xs text-blue-500 hover:text-blue-700"
                          >
                            Éditer
                          </button>
                          <button
                            onClick={() => handleDelete(d.id)}
                            disabled={pending}
                            className="text-xs text-red-400 hover:text-red-600"
                          >
                            Suppr.
                          </button>
                        </>
                      )}
                      {d.kind === "SYSTEM" && (
                        <span className="text-[10px] text-gray-300">système</span>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="border-t px-5 py-4 flex gap-2">
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Nouveau label…"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <select
                value={newBehavior}
                onChange={(e) => setNewBehavior(e.target.value as DispositionBehavior)}
                className="rounded-lg border border-gray-200 px-2 py-2 text-sm"
              >
                {(["NONE", "CALLBACK", "VOICEMAIL"] as DispositionBehavior[]).map((b) => (
                  <option key={b} value={b}>
                    {BEHAVIOR_LABELS[b]}
                  </option>
                ))}
              </select>
              <button
                onClick={handleCreate}
                disabled={pending || !newLabel.trim()}
                className="rounded-lg bg-gray-800 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── ProspectCard ─────────────────────────────────────────────────────────

export function ProspectCard({
  prospect,
  allTags,
  dispositions,
  activeCallAttemptId,
  onRefresh,
}: Props) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {prospect.company ?? prospect.contactName ?? prospect.phoneNumber}
            </h2>
            {prospect.company && prospect.contactName && (
              <p className="text-sm text-gray-500">{prospect.contactName}</p>
            )}
            <p className="mt-1 font-mono text-sm text-gray-700">{prospect.phoneNumber}</p>
          </div>
          <div className="text-right space-y-1">
            {prospect.status === "EXCLUDED" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                Exclu
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                Actif
              </span>
            )}
          </div>
        </div>

        <div className="text-xs text-gray-400 space-y-0.5">
          <p>
            Liste : <span className="text-gray-600">{prospect.list.name}</span>
          </p>
          <p>
            Base légale : <span className="text-gray-600">{prospect.list.legalBasis}</span>
          </p>
        </div>

        <TagManager
          prospectId={prospect.id}
          tags={prospect.tags}
          allTags={allTags}
          onRefresh={onRefresh}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Notes */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Notes</h3>
          <NoteBlock prospectId={prospect.id} notes={prospect.notes} onRefresh={onRefresh} />
        </div>

        {/* Disposition + Historique */}
        <div className="space-y-4">
          {activeCallAttemptId && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Disposition</h3>
                <DispositionManager dispositions={dispositions} onRefresh={onRefresh} />
              </div>
              <DispositionSelector
                prospectId={prospect.id}
                callAttemptId={activeCallAttemptId}
                dispositions={dispositions}
                onRefresh={onRefresh}
              />
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Historique des appels</h3>
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {prospect.callAttempts.length === 0 && (
                <p className="text-xs text-gray-400">Aucun appel</p>
              )}
              {prospect.callAttempts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs"
                >
                  <div>
                    <span className="text-gray-500">{fmt(a.startedAt)}</span>
                    <span className="ml-2 text-gray-400">{SLOT_LABEL[a.slot]}</span>
                    {a.callbackAt && (
                      <span className="ml-2 text-orange-500">Rappel {fmt(a.callbackAt)}</span>
                    )}
                  </div>
                  <div className="text-right">
                    {a.result && (
                      <span className={`font-medium ${RESULT_COLOR[a.result]}`}>
                        {RESULT_LABEL[a.result]}
                      </span>
                    )}
                    {a.disposition && (
                      <span className="ml-2 text-gray-400">{a.disposition.label}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
