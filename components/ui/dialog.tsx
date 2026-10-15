"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { t } from "@/lib/i18n";
import { Icon } from "./icons";

/**
 * Modal built on the native <dialog> element (focus trapping and Esc handled by the browser).
 * Renders as a bottom sheet on phones and a centered card from the `sm` breakpoint.
 */
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
    if (open && !dialog.open) {
      dialog.showModal();
      // showModal focuses the first focusable element (the close button); prefer a marked field.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="mx-auto mt-auto mb-0 max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-[28px] bg-surface p-0 text-foreground shadow-elevation-2 backdrop:bg-black/45 backdrop:backdrop-blur-[2px] sm:m-auto sm:w-[calc(100%-2rem)] sm:max-w-lg sm:rounded-[28px]"
    >
      <div className="mx-auto mt-3 h-1 w-9 rounded-full bg-border sm:hidden" aria-hidden="true" />
      <div className="flex items-start justify-between gap-3 px-6 pt-4 sm:pt-6">
        <h2 className="pt-1.5 text-xl leading-snug">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="-mr-2 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
          aria-label={t("common.close")}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="px-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{children}</div>
    </dialog>
  );
}
