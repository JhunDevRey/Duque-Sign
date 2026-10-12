"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useLocalWorkspace } from "@/components/local-workspace";
import { DocumentStatusBadge, RecipientStatusBadge } from "@/components/status-badge";
import { NotConnectedButton } from "@/components/preview";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { readOriginalPdf } from "@/lib/preview/local-workspace";
import { SAMPLE_PDF_URL } from "@/lib/preview/sample-data";
import { isFirebaseClientConfigured } from "@/lib/firebase/client";

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
        if (document.originalPdfStorage === "browser") {
          blob = await readOriginalPdf(document.id);
          if (!blob) throw new Error("This draft's PDF is only available in the browser and device where it was uploaded.");
        } else if (isFirebaseClientConfigured) {
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
    return <AppShell><p className="text-sm text-muted">{t("common.loading")}</p></AppShell>;
  }
  if (!document) {
    return (
      <AppShell>
        <Notice tone="warning" title={t("notFound.title")}>{t("documents.notFound")}</Notice>
        <Link href="/documents" className="mt-4 inline-flex text-sm text-accent hover:underline">← {t("common.back")}</Link>
      </AppShell>
    );
  }

  const documentId = document.id;
  async function cancelDocument() {
    if (!window.confirm("Cancel this document? This action cannot be reversed.")) return;
    try {
      if (isFirebaseClientConfigured) {
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

  return (
    <AppShell>
      <PageHeader
        title={document.title}
        subtitle={document.externalId ? t("documents.reference", { ref: document.externalId }) : undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            {document.status === "draft" && (
              <Link href={`/documents/${document.id}/fields`} className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-muted">
                {t("documents.editFields")}
              </Link>
            )}
            <NotConnectedButton
              variant="primary"
              noticeTitle={t("documents.sendUnavailableTitle")}
              noticeMessage={t("documents.sendUnavailableMessage")}
            >
              {t("documents.send")}
            </NotConnectedButton>
            {(document.status === "draft" || document.status === "in_progress") && (
              <Button variant="danger" onClick={cancelDocument}>{t("documents.cancelDocument")}</Button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-6">
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <DocumentStatusBadge status={document.status} />
              <div className="text-sm text-muted">{t("documents.version", { version: document.version })}</div>
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">{t("documents.createdBy")}</dt>
                <dd className="mt-1 font-medium">{document.createdBy}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">{t("documents.pages", { count: document.pageCount })}</dt>
                <dd className="mt-1 font-medium">{document.pageCount}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">{t("documents.sentAt")}</dt>
                <dd className="mt-1 font-medium">{document.sentAt ? formatDateTime(document.sentAt) : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">{t("documents.expiresAt")}</dt>
                <dd className="mt-1 font-medium">{document.expiresAt ? formatDateTime(document.expiresAt) : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">{t("documents.completedAt")}</dt>
                <dd className="mt-1 font-medium">{document.completedAt ? formatDateTime(document.completedAt) : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">{t("documents.finalHash")}</dt>
                <dd className="mt-1 break-all font-medium">{document.finalSha256 || "—"}</dd>
              </div>
              {document.originalFileName && (
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-muted">Original PDF</dt>
                  <dd className="mt-1 break-all font-medium">{document.originalFileName}</dd>
                </div>
              )}
            </dl>
          </Card>

          <Card>
            <div className="border-b border-border px-4 py-3 text-sm font-semibold">{t("documents.recipients")}</div>
            <div className="space-y-3 p-4">
              {document.recipients.map((recipient) => (
                <div key={recipient.id} className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{recipient.name}</p>
                    <p className="break-all text-sm text-muted">{recipient.email}</p>
                    <p className="text-xs text-muted">{recipient.role}</p>
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <RecipientStatusBadge status={recipient.status} />
                    <span className="text-xs text-muted">{t("documents.signingOrder", { order: recipient.order })}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-3 text-sm font-semibold">{t("documents.previewDocument")}</div>
            {document.originalPdfStorage === "browser" && (
              <Notice tone="warning" className="mb-3">{t("documents.localPdfNotice")}</Notice>
            )}
            {pdfError ? (
              <Notice tone="danger">{pdfError}</Notice>
            ) : pdfUrl ? (
              <iframe title={document.originalFileName ?? document.title} src={pdfUrl} className="h-[65vh] min-h-96 w-full rounded-md border border-border bg-white" />
            ) : (
              <div className="flex h-64 items-center justify-center rounded-md bg-surface-muted text-sm text-muted">{t("common.loading")}</div>
            )}
            {pdfUrl && (
              <a href={pdfUrl} download={document.originalFileName ?? "sample-agreement.pdf"} className="mt-3 inline-flex text-sm text-accent hover:underline">
                {t("documents.downloadOriginal")}
              </a>
            )}
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="p-4">
            <div className="mb-3 text-sm font-semibold">{t("documents.details")}</div>
            <div className="space-y-3 text-sm text-muted">
              <div className="flex justify-between gap-3">
                <span>{t("documents.delivery")}</span>
                <span className="text-right font-medium text-foreground">
                  {document.recipients.some((recipient) => recipient.delivery === "link") ? t("documents.deliveryLink") : t("documents.deliveryEmail")}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span>{t("editor.fields")}</span>
                <span className="text-right font-medium text-foreground">{document.fields?.length ?? 0}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>{t("documents.externalId")}</span>
                <span className="break-all text-right font-medium text-foreground">{document.externalId || "—"}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>{t("common.updated")}</span>
                <span className="text-right font-medium text-foreground">{formatDateTime(document.updatedAt)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Original file</span>
                <span className="text-right font-medium text-foreground">{document.originalFileName ?? "Sample PDF"}</span>
              </div>
            </div>
          </Card>
          {document.status === "completed" && (
            <Card className="p-4">
              <p className="text-sm font-semibold">{t("documents.downloadFinal")}</p>
              <p className="mt-2 text-sm text-muted">A signed final PDF is not available in the local workspace.</p>
            </Card>
          )}
          <Link href="/documents" className="inline-flex text-sm text-accent hover:underline">← {t("common.back")}</Link>
        </aside>
      </div>
    </AppShell>
  );
}
