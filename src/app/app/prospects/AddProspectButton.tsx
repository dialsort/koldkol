"use client";

import { useState } from "react";
import AddProspectModal from "./AddProspectModal";

interface ListOption { id: string; name: string }

export default function AddProspectButton({ lists }: { lists: ListOption[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:border-red-200 hover:text-red-600 hover:bg-red-50/40 transition-all duration-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex items-center gap-2"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Ajouter
      </button>

      {open && <AddProspectModal lists={lists} onClose={() => setOpen(false)} />}
    </>
  );
}
