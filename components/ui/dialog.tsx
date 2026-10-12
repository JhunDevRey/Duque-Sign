"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { t } from "@/lib/i18n";

/** Modal built on the native <dialog> element (focus trapping and Esc handled by the browser). */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-border bg-surface p-0 text-foreground backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
        <button type="button" onClick={onClose} className="rounded px-2 text-muted hover:text-foreground" aria-label={t("common.close")}>
          ✕
        </button>
      </div>
      <div className="p-4">{children}</div>
    </dialog>
  );
}
