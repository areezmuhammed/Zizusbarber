"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

// Bottom sheet on the native <dialog>: modal focus trap, Escape to close and focus return come from the browser.
export function Sheet({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current!;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()} // tap on the backdrop
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border-t border-border bg-card p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-card-foreground backdrop:bg-black/70 sm:mx-auto sm:max-w-lg motion-safe:open:animate-in motion-safe:open:slide-in-from-bottom"
    >
      <div className="mb-4 flex items-start gap-3">
        <h2 id={id} className="flex-1 pt-2 font-heading text-2xl leading-tight">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-2 grid size-12 shrink-0 place-items-center rounded-sm text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary"
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>
      {open && children}
    </dialog>
  );
}
