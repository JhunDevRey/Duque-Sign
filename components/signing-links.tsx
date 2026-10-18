"use client";

import { useState } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { SIGNING_LINK_TTL_DAYS } from "@/lib/config/app";
import type { DocumentSummary, Recipient, SigningLink } from "@/lib/domain/types";
import { t } from "@/lib/i18n";

async function postJson<T>(url: string, body: unknown, fallback: string): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
        ? result.error
        : fallback;
    throw new Error(message);
  }
  return result as T;
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        readOnly
        value={url}
        aria-label="Signing link"
        onFocus={(event) => event.currentTarget.select()}
        className="h-10 min-w-0 flex-1 rounded-xs border border-outline-variant bg-surface px-3 font-mono text-body-small focus:border-primary focus:outline-none"
      />
      <Button
        size="sm"
        variant="secondary"
        className="shrink-0"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? t("documents.linkCopied") : t("documents.linkCopy")}
      </Button>
    </div>
  );
}

function recipientsMissingSignature(document: DocumentSummary): Recipient[] {
  const fields = document.fields ?? [];
  return document.recipients.filter(
    (recipient) => !fields.some((field) => field.recipientId === recipient.id && field.type === "signature" && field.required),
  );
}

/** Sends a draft and shows each recipient's signing link once. */
export function SendDocumentButton({
  document,
  organizationId,
  onSent,
}: {
  document: DocumentSummary;
  organizationId: string;
  onSent: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<SigningLink[] | null>(null);
  const missing = recipientsMissingSignature(document);

  async function send() {
    setSending(true);
    setError(null);
    try {
      const result = await postJson<{ links: SigningLink[] }>(
        `/api/documents/${encodeURIComponent(document.id)}/send`,
        { organizationId },
        "Unable to send the document.",
      );
      setConfirming(false);
      setLinks(result.links);
      await onSent();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send the document.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Button variant="primary" onClick={() => { setError(null); setConfirming(true); }}>{t("documents.send")}</Button>

      <Dialog open={confirming} onClose={() => !sending && setConfirming(false)} title={t("documents.sendConfirmTitle")}>
        <div className="space-y-4">
          {missing.length > 0 ? (
            <Notice tone="warning">{t("documents.sendMissingSignature", { names: missing.map((recipient) => recipient.name).join(", ") })}</Notice>
          ) : (
            <p className="text-body-medium text-on-surface-variant">{t("documents.sendConfirmBody", { days: SIGNING_LINK_TTL_DAYS })}</p>
          )}
          {error && <Notice tone="danger">{error}</Notice>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={sending}>{t("common.cancel")}</Button>
            <Button variant="primary" onClick={send} disabled={sending || missing.length > 0}>
              {sending ? t("documents.sending") : t("documents.send")}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={links !== null} onClose={() => setLinks(null)} title={t("documents.linksTitle")}>
        <div className="space-y-4">
          <Notice tone="warning">{t("documents.linksOnce")}</Notice>
          {links?.some((link) => link.delivery === "email") && <Notice>{t("documents.linksManualDelivery")}</Notice>}
          {links && new Set(document.recipients.map((recipient) => recipient.order)).size > 1 && (
            <p className="text-body-medium text-on-surface-variant">{t("documents.linksSequential")}</p>
          )}
          <ul className="space-y-3">
            {links?.map((link) => (
              <li key={link.recipientId} className="space-y-2 rounded-md bg-surface-container p-4">
                <div>
                  <p className="text-title-medium">{link.name}</p>
                  <p className="break-all text-body-medium text-on-surface-variant">{link.email}</p>
                </div>
                <CopyLink url={link.url} />
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => setLinks(null)}>{t("common.close")}</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

/**
 * The signed PDF for a completed document, or a retry when every recipient has signed but the
 * final PDF could not be generated at the time.
 */
export function SignedPdfCard({
  document,
  organizationId,
  onFinalized,
}: {
  document: DocumentSummary;
  organizationId: string;
  onFinalized: () => Promise<void>;
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allSigned = document.recipients.length > 0 && document.recipients.every((recipient) => recipient.status === "signed");

  if (document.status === "completed") {
    return (
      <div className="rounded-md bg-success-container p-5 text-on-success-container sm:p-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-full bg-success text-on-success">
            <Icon name="check" />
          </span>
          <p className="text-title-medium">{t("documents.downloadFinal")}</p>
        </div>
        <p className="mt-3 text-body-medium opacity-90">Includes every signature and a signing certificate page.</p>
        <a
          href={`/api/documents/${encodeURIComponent(document.id)}/signed?organizationId=${encodeURIComponent(organizationId)}`}
          className={buttonClass("primary", "md", "mt-4 w-full")}
        >
          <Icon name="download" className="size-[18px]" />
          Download signed PDF
        </a>
      </div>
    );
  }
  if (document.status !== "in_progress" || !allSigned) return null;

  async function finalize() {
    setWorking(true);
    setError(null);
    try {
      await postJson(`/api/documents/${encodeURIComponent(document.id)}/signed`, { organizationId }, "Unable to generate the signed PDF.");
      await onFinalized();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to generate the signed PDF.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="rounded-md bg-warning-container p-5 text-on-warning-container sm:p-6">
      <p className="text-title-medium">Everyone has signed</p>
      <p className="mt-2 text-body-medium opacity-90">The signed PDF wasn&apos;t generated yet. Generate it now to complete the document.</p>
      {error && <p role="alert" className="mt-2 text-body-medium text-error">{error}</p>}
      <Button variant="primary" className="mt-4 w-full" onClick={finalize} disabled={working}>
        {working ? "Generating…" : "Generate signed PDF"}
      </Button>
    </div>
  );
}

/** Replaces one recipient's signing link and shows the new one once. */
export function ReissueLinkButton({
  documentId,
  organizationId,
  recipient,
}: {
  documentId: string;
  organizationId: string;
  recipient: Recipient;
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  async function reissue() {
    if (!window.confirm(t("documents.newLinkConfirm", { name: recipient.name }))) return;
    setWorking(true);
    setError(null);
    try {
      const result = await postJson<{ url: string }>(
        `/api/documents/${encodeURIComponent(documentId)}/recipients/${encodeURIComponent(recipient.id)}/link`,
        { organizationId },
        "Unable to issue a new signing link.",
      );
      setUrl(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to issue a new signing link.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={reissue} disabled={working}>{t("documents.newLink")}</Button>
      {error && <span className="text-body-small text-error">{error}</span>}
      <Dialog open={url !== null} onClose={() => setUrl(null)} title={t("documents.newLinkTitle")}>
        <div className="space-y-4">
          <Notice tone="warning">{t("documents.linksOnce")}</Notice>
          <div>
            <p className="text-title-medium">{recipient.name}</p>
            <p className="break-all text-body-medium text-on-surface-variant">{recipient.email}</p>
          </div>
          {url && <CopyLink url={url} />}
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => setUrl(null)}>{t("common.close")}</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
