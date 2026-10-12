"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { t } from "@/lib/i18n";
import { isSupabaseClientConfigured } from "@/lib/supabase/client";

/** Site-wide banner shown while the UI runs without a backend. */
export function PreviewBanner() {
  return (
    <div className="border-b border-warning/30 bg-warning-soft px-4 py-2 text-center text-xs font-medium text-warning sm:text-sm">
      {isSupabaseClientConfigured
        ? "Supabase authentication is enabled. Document data, PDF storage, email delivery, recipient signing, and finalization are being migrated."
        : "Supabase is not configured. Document data, PDF storage, email delivery, recipient signing, and finalization are unavailable."}
    </div>
  );
}

/**
 * A button for an action that needs the backend. Clicking it explains that nothing happened,
 * instead of pretending to succeed.
 */
export function NotConnectedButton({
  children,
  variant = "secondary",
  size,
  disabled,
  noticeTitle,
  noticeMessage,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  disabled?: boolean;
  noticeTitle?: string;
  noticeMessage?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <span className="relative inline-flex flex-col items-end">
      <Button variant={variant} size={size} disabled={disabled} onClick={() => setShown(true)}>
        {children}
      </Button>
      {shown && (
        <span className="absolute top-full right-0 z-20 mt-2 w-72">
          <Notice tone="warning" title={noticeTitle ?? t("preview.notConnectedTitle")}>
            <p>{noticeMessage ?? t("preview.notConnected")}</p>
            <button type="button" className="mt-1 text-xs underline" onClick={() => setShown(false)}>
              {t("common.close")}
            </button>
          </Notice>
        </span>
      )}
    </span>
  );
}

/** Form wrapper whose submit is intercepted and answered with a "not connected" notice. */
export function PreviewForm({
  children,
  className,
  validate,
}: {
  children: ReactNode;
  className?: string;
  validate?: (data: FormData) => string | null;
}) {
  const [message, setMessage] = useState<{ tone: "warning" | "danger"; text: string } | null>(null);
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const error = validate?.(new FormData(e.currentTarget));
        setMessage(error ? { tone: "danger", text: error } : { tone: "warning", text: t("preview.notConnected") });
      }}
    >
      {children}
      {message && (
        <Notice tone={message.tone} className="mt-4" title={message.tone === "warning" ? t("preview.notConnectedTitle") : undefined}>
          {message.text}
        </Notice>
      )}
    </form>
  );
}
