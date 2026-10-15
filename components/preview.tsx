"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Notice } from "@/components/ui/notice";
import { t } from "@/lib/i18n";
import { isSupabaseClientConfigured } from "@/lib/supabase/client";

/** Site-wide banner shown while the UI runs without a backend. */
export function PreviewBanner() {
  return (
    <div className="px-4 pt-3 sm:px-6 lg:px-10">
      <p className="mx-auto flex max-w-6xl items-start gap-2 rounded-2xl bg-warning-soft px-4 py-2.5 text-xs text-warning sm:text-sm">
        <Icon name="alert" className="mt-px size-4" />
        <span>
          {isSupabaseClientConfigured
            ? "Prototype: email delivery is not connected, so share signing links yourself. Do not send real client documents until this workspace has been reviewed for production use."
            : "Supabase is not configured. Document data, PDF storage, email delivery, recipient signing, and finalization are unavailable."}
        </span>
      </p>
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
        <span className="absolute top-full right-0 z-20 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl shadow-elevation-2">
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
