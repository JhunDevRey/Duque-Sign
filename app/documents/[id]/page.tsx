"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useLocalWorkspace } from "@/components/local-workspace";
import { DocumentStatusBadge, RecipientStatusBadge } from "@/components/status-badge";
import { NotConnectedButton } from "@/components/preview";
import { ReissueLinkButton, SendDocumentButton, SignedPdfCard } from "@/components/signing-links";
import { Avatar } from "@/components/shell/auth-controls";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Card, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { readOriginalPdf } from "@/lib/preview/local-workspace";
import { SAMPLE_PDF_URL } from "@/lib/preview/sample-data";
import { isSupabaseClientConfigured } from "@/lib/supabase/client";

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { documents, updateDocument, ready, organizationId, refresh } = useLocalWorkspace();
  const document = documents.find((item) => item.id === id);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    async function loadPdf() {
      if (!document) return;
      try {
        if (!document.originalFileName) {
          setPdfUrl(SAMPLE_PDF_URL);
          return;
        }
        let blob: Blob | null;
        if (isSupabaseClientConfigured) {
          if (!organizationId) throw new Error("No organization is selected for this workspace.");
          const response = await fetch(
            `/api/documents/${encodeURIComponent(document.id)}/file?organizationId=${encodeURIComponent(organizationId)}`,
            { cache: "no-store" },
          );
          if (!response.ok) throw new Error("The original PDF could not be retrieved.");
          blob = await response.blob();
        } else {
          blob = await readOriginalPdf(document.id);
        }
        if (!blob) throw new Error("The original PDF is missing from this browser's local storage.");
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setPdfUrl(objectUrl);
      } catch (cause) {
        if (!cancelled) setPdfError(cause instanceof Error ? cause.message : "Unable to load the PDF.");
      }
    }

    void loadPdf();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [document, organizationId]);

  if (!ready) {
    return (
      <AppShell>
        <div className="space-y-4">
          <div className="h-10 w-2/3 animate-pulse rounded-2xl bg-surface-muted" />
          <div className="h-64 animate-pulse rounded-3xl bg-surface-muted" />
        </div>
      </AppShell>
    );
  }
  if (!document) {
    return (
      <AppShell>
        <Notice tone="warning" title={t("notFound.title")}>{t("documents.notFound")}</Notice>
        <Link href="/documents" className="mt-4 inline-flex text-sm font-medium text-accent underline-offset-4 hover:underline">← {t("common.back")}</Link>
      </AppShell>
    );
  }

  const documentId = document.id;
  async function cancelDocument() {
    if (!window.confirm("Cancel this document? This action cannot be reversed.")) return;
    try {
      if (isSupabaseClientConfigured) {
        if (!organizationId) throw new Error("No organization is selected for this workspace.");
        const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId, action: "cancel" }),
        });
        if (!response.ok) {
          const result: unknown = await response.json();
          const message =
            typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
              ? result.error
              : "Unable to cancel this document.";
          throw new Error(message);
        }
        await refresh();
      } else {
        updateDocument(documentId, { status: "cancelled", updatedAt: new Date().toISOString() });
      }
    } catch (cause) {
      setPdfError(cause instanceof Error ? cause.message : "Unable to update this document.");
    }
  }

  const awaitingSignature = document.status === "sent" || document.status === "in_progress";
  const signedCount = document.recipients.filter((recipient) => recipient.status === "signed").length;
  const facts: Array<{ label: string; value: string; mono?: boolean }> = [
    { label: t("documents.createdBy"), value: document.createdBy },
    { label: t("documents.pages", { count: document.pageCount }), value: String(document.pageCount) },
    { label: t("documents.sentAt"), value: document.sentAt ? formatDateTime(document.sentAt) : "—" },
    { label: t("documents.expiresAt"), value: document.expiresAt ? formatDateTime(document.expiresAt) : "—" },
    { label: t("documents.completedAt"), value: document.completedAt ? formatDateTime(document.completedAt) : "—" },
    { label: t("documents.finalHash"), value: document.finalSha256 || "—", mono: true },
  ];

  return (
    <AppShell>
      <Link href="/documents" className="mb-4 inline-flex items-center gap-1.5 rounded-full py-1.5 pr-3 pl-1 text-sm text-muted hover:text-foreground">
        <Icon name="back" className="size-[18px]" />
        {t("common.back")}
      </Link>
      <PageHeader
        title={document.title}
        subtitle={document.externalId ? t("documents.reference", { ref: document.externalId }) : undefined}
        actions={
          <>
            {document.status === "draft" && (
              <ButtonLink href={`/documents/${document.id}/fields`} variant="secondary">
                <Icon name="edit" className="size-[18px]" />
                {t("documents.editFields")}
              </ButtonLink>
            )}
            {document.status === "draft" && (isSupabaseClientConfigured && organizationId ? (
              <SendDocumentButton document={document} organizationId={organizationId} onSent={refresh} />
            ) : (
              <NotConnectedButton
                variant="primary"
                noticeTitle={t("documents.sendUnavailableTitle")}
                noticeMessage={t("documents.sendUnavailableMessage")}
              >
                {t("documents.send")}
              </NotConnectedButton>
            ))}
            {(document.status === "draft" || awaitingSignature) && (
              <Button variant="danger" onClick={cancelDocument}>{t("documents.cancelDocument")}</Button>
            )}
          </>
        }
      />

      {pdfError && <Notice tone="danger" className="mb-6">{pdfError}</Notice>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <DocumentStatusBadge status={document.status} />
              <span className="text-sm text-muted">{t("documents.version", { version: document.version })}</span>
            </div>
            {document.recipients.length > 0 && document.status !== "draft" && (
              <div className="mt-5">
                <p className="text-xs text-muted">
                  {signedCount} / {document.recipients.length} {t("recipientStatus.signed").toLocaleLowerCase()}
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${(signedCount / document.recipients.length) * 100}%`, background: "var(--brand-gradient)" }}
                  />
                </div>
              </div>
            )}
            <dl className="mt-5 grid grid-cols-2 gap-2">
              {facts.map((fact) => (
                <div key={fact.label} className={fact.mono ? "col-span-2 rounded-2xl bg-surface-muted px-4 py-3" : "rounded-2xl bg-surface-muted px-4 py-3"}>
                  <dt className="text-xs text-muted">{fact.label}</dt>
                  <dd className={fact.mono && document.finalSha256 ? "mt-1 break-all font-mono text-xs" : "mt-1 break-words text-sm font-medium"}>{fact.value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title={t("documents.recipients")} />
            <ul className="space-y-2 px-3 pb-3 sm:px-4 sm:pb-4">
              {document.recipients.map((recipient) => (
                <li key={recipient.id} className="flex flex-col gap-3 rounded-2xl bg-surface-muted p-3 sm:flex-row sm:items-center sm:p-4">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={recipient.name} className="size-10" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{recipient.name}</p>
                      <p className="truncate text-sm text-muted">{recipient.email}</p>
                      <p className="text-xs text-muted">{recipient.role} · {t("documents.signingOrder", { order: recipient.order })}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-13 sm:justify-end sm:pl-0">
                    <RecipientStatusBadge status={recipient.status} />
                    {isSupabaseClientConfigured && organizationId && awaitingSignature &&
                      recipient.status !== "signed" && recipient.status !== "declined" && (
                      <ReissueLinkButton documentId={document.id} organizationId={organizationId} recipient={recipient} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title={t("documents.previewDocument")}
              action={pdfUrl && (
                <a
                  href={pdfUrl}
                  download={document.originalFileName ?? "sample-agreement.pdf"}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent-soft/50"
                >
                  <Icon name="download" className="size-4" />
                  <span className="hidden sm:inline">{t("documents.downloadOriginal")}</span>
                </a>
              )}
            />
            <div className="px-3 pb-3 sm:px-4 sm:pb-4">
              {pdfUrl ? (
                <iframe title={document.originalFileName ?? document.title} src={pdfUrl} className="h-[70vh] min-h-96 w-full rounded-2xl border border-border/70 bg-white" />
              ) : !pdfError ? (
                <div className="h-96 animate-pulse rounded-2xl bg-surface-muted" />
              ) : null}
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="p-5 sm:p-6">
            <h2 className="text-base font-medium">{t("documents.details")}</h2>
            <dl className="mt-4 divide-y divide-border/60 text-sm">
              {[
                [t("documents.delivery"), document.recipients.some((recipient) => recipient.delivery === "link") ? t("documents.deliveryLink") : t("documents.deliveryEmail")],
                [t("editor.fields"), String(document.fields?.length ?? 0)],
                [t("documents.externalId"), document.externalId || "—"],
                [t("common.updated"), formatDateTime(document.updatedAt)],
                ["Original file", document.originalFileName ?? "Sample PDF"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 py-2.5">
                  <dt className="text-muted">{label}</dt>
                  <dd className="min-w-0 break-all text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
          {isSupabaseClientConfigured && organizationId ? (
            <SignedPdfCard document={document} organizationId={organizationId} onFinalized={refresh} />
          ) : document.status === "completed" && (
            <Card className="p-5 sm:p-6">
              <p className="font-medium">{t("documents.downloadFinal")}</p>
              <p className="mt-2 text-sm text-muted">A signed final PDF is not available in the local workspace.</p>
            </Card>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
