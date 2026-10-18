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
      className="mx-auto mt-auto mb-0 max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-2xl bg-surface-container-low p-0 text-on-surface shadow-elevation-1 backdrop:bg-scrim/32 sm:m-auto sm:w-[calc(100%-3rem)] sm:max-w-[560px] sm:rounded-2xl sm:bg-surface-container-high sm:shadow-elevation-3"
    >
      <div className="mx-auto mt-4 h-1 w-8 rounded-full bg-on-surface-variant/40 sm:hidden" aria-hidden="true" />
      <div className="flex items-start justify-between gap-3 px-6 pt-4 sm:pt-6">
        <h2 className="pt-1 text-headline-small">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="state-layer -mr-2 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant"
          aria-label={t("common.close")}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="px-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{children}</div>
    </dialog>
  );
}
