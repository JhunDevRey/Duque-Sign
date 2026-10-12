"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PDFDocument } from "pdf-lib";
import { AppShell } from "@/components/app-shell";
import { useLocalWorkspace } from "@/components/local-workspace";
import { Notice } from "@/components/ui/notice";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_PAGES } from "@/lib/config/app";
import { formatBytes } from "@/lib/format";
import type { Delivery, DocumentSummary, Recipient } from "@/lib/domain/types";
import { removeOriginalPdf, storeOriginalPdf } from "@/lib/preview/local-workspace";
import { sampleViewer } from "@/lib/preview/sample-data";
import { t } from "@/lib/i18n";
import { isFirebaseClientConfigured } from "@/lib/firebase/client";

type RecipientDraft = {
  name: string;
  email: string;
  role: string;
  delivery: Delivery;
};

const blankRecipient = (): RecipientDraft => ({ name: "", email: "", role: "Client", delivery: "email" });

export default function NewDocumentPage() {
  const router = useRouter();
  const { createDraft, ready, organizationId, refresh } = useLocalWorkspace();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [externalId, setExternalId] = useState("");
  const [recipients, setRecipients] = useState<RecipientDraft[]>([blankRecipient()]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateRecipient(index: number, update: Partial<RecipientDraft>) {
    setRecipients((current) => current.map((recipient, i) => i === index ? { ...recipient, ...update } : recipient));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!file) {
      setError("Choose a PDF file before saving the draft.");
      return;
    }
    if (file.type !== "application/pdf" && !file.name.toLocaleLowerCase().endsWith(".pdf")) {
      setError(t("newDocument.errorType"));
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(t("newDocument.errorSize", { size: formatBytes(MAX_UPLOAD_BYTES) }));
      return;
    }
    if (!title.trim()) {
      setError("Enter a document title.");
      return;
    }
    if (recipients.some((recipient) => !recipient.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.email) || !recipient.role.trim())) {
      setError(t("newDocument.errorRecipientFields"));
      return;
    }
    const normalizedEmails = recipients.map((recipient) => recipient.email.trim().toLocaleLowerCase());
    if (new Set(normalizedEmails).size !== normalizedEmails.length) {
      setError(t("newDocument.errorDuplicateEmail"));
      return;
    }

    setSaving(true);
    let localPdfId: string | null = null;
    try {
      const bytes = await file.arrayBuffer();
      if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
        throw new Error(t("newDocument.errorMalformed"));
      }
      const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
      const pageCount = pdf.getPageCount();
      if (pageCount < 1) throw new Error(t("newDocument.errorMalformed"));
      if (pageCount > MAX_UPLOAD_PAGES) {
        throw new Error(t("newDocument.errorPages", { pages: MAX_UPLOAD_PAGES }));
      }

      const id = `doc_${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      const savedRecipients: Recipient[] = recipients.map((recipient, index) => ({
        id: `rcp_${crypto.randomUUID()}`,
        name: recipient.name.trim(),
        email: recipient.email.trim(),
        role: recipient.role.trim(),
        order: index + 1,
        delivery: recipient.delivery,
        status: "waiting",
      }));
      const document: DocumentSummary = {
        id,
        title: title.trim(),
        status: "draft",
        externalId: externalId.trim() || undefined,
        originalFileName: file.name,
        originalPdfStorage: isFirebaseClientConfigured ? "browser" : undefined,
        version: 1,
        pageCount,
        createdBy: sampleViewer.name,
        createdAt: now,
        updatedAt: now,
        recipients: savedRecipients,
      };

      if (isFirebaseClientConfigured) {
        if (!organizationId) throw new Error("Create an organization before saving documents.");
        await storeOriginalPdf(id, file);
        localPdfId = id;
        const form = new FormData();
        form.set("organizationId", organizationId);
        form.set("documentId", id);
        form.set("pdfStorage", "browser");
        form.set("title", document.title);
        form.set("externalId", document.externalId ?? "");
        form.set("recipients", JSON.stringify(recipients));
        form.set("file", file);
        const response = await fetch("/api/documents", { method: "POST", body: form });
        const result: unknown = await response.json();
        if (!response.ok) {
          const message =
            typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
              ? result.error
              : "Unable to save the document.";
          throw new Error(message);
        }
        if (typeof result !== "object" || result === null || !("document" in result) || typeof result.document !== "object" || result.document === null || !("id" in result.document) || typeof result.document.id !== "string") {
          throw new Error("The server response did not include the saved document ID.");
        }
        localPdfId = null;
        await refresh();
        router.push(`/documents/${result.document.id}`);
        return;
      }
      await storeOriginalPdf(id, file);
      createDraft(document);
      router.push(`/documents/${id}`);
    } catch (cause) {
      if (localPdfId) {
        try {
          await removeOriginalPdf(localPdfId);
        } catch (cleanupError) {
          console.error("Failed to remove the unsaved local PDF", cleanupError);
        }
      }
      setError(cause instanceof Error ? cause.message : "Unable to validate and save this PDF.");
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <PageHeader title={t("newDocument.title")} subtitle={isFirebaseClientConfigured ? t("newDocument.firebaseSubtitle") : t("newDocument.localSubtitle")} />
      <div className="mb-5">
        <ButtonLink href="/documents" variant="ghost" size="sm">← {t("common.back")}</ButtonLink>
      </div>
      <form onSubmit={submit} className="mx-auto max-w-3xl space-y-5">
        {error && <Notice tone="danger" title="Unable to save draft">{error}</Notice>}
        {isFirebaseClientConfigured && (
          <Notice tone="warning" title={t("documents.localPdfTitle")}>{t("newDocument.localPdfNotice")}</Notice>
        )}
        {!ready && <Notice>{t("common.loading")}</Notice>}

        <Card className="space-y-4 p-4 sm:p-6">
          <h2 className="font-semibold">{t("newDocument.stepUpload")}</h2>
          <Field label={t("newDocument.documentTitle")} htmlFor="document-title">
            <Input id="document-title" required value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} />
          </Field>
          <Field label={t("newDocument.externalId")} hint={t("newDocument.externalIdHint")} htmlFor="external-id">
            <Input id="external-id" value={externalId} onChange={(event) => setExternalId(event.target.value)} maxLength={120} />
          </Field>
          <Field label={t("newDocument.chooseFile")} hint={t("newDocument.uploadHint", { size: formatBytes(MAX_UPLOAD_BYTES), pages: MAX_UPLOAD_PAGES })} htmlFor="pdf-file">
            <Input id="pdf-file" type="file" accept="application/pdf,.pdf" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="h-auto py-2 file:mr-3 file:rounded file:border-0 file:bg-accent-soft file:px-3 file:py-1 file:font-medium file:text-accent" />
          </Field>
          {file && <p className="text-sm text-muted">{file.name} · {formatBytes(file.size)}</p>}
        </Card>

        <Card className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">{t("newDocument.stepRecipients")}</h2>
              <p className="mt-1 text-sm text-muted">Recipients are saved in signing order. Email is not sent when a draft is created.</p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => setRecipients((current) => [...current, blankRecipient()])}>
              + {t("newDocument.addRecipient")}
            </Button>
          </div>
          {recipients.map((recipient, index) => (
            <div key={index} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
              <Field label={t("newDocument.recipientName")} htmlFor={`recipient-name-${index}`}>
                <Input id={`recipient-name-${index}`} required value={recipient.name} onChange={(event) => updateRecipient(index, { name: event.target.value })} />
              </Field>
              <Field label={t("newDocument.recipientEmail")} htmlFor={`recipient-email-${index}`}>
                <Input id={`recipient-email-${index}`} type="email" required value={recipient.email} onChange={(event) => updateRecipient(index, { email: event.target.value })} />
              </Field>
              <Field label={t("newDocument.recipientRole")} htmlFor={`recipient-role-${index}`}>
                <Input id={`recipient-role-${index}`} required value={recipient.role} onChange={(event) => updateRecipient(index, { role: event.target.value })} />
              </Field>
              <Field label={t("newDocument.delivery")} htmlFor={`recipient-delivery-${index}`}>
                <Select id={`recipient-delivery-${index}`} value={recipient.delivery} onChange={(event) => updateRecipient(index, { delivery: event.target.value as Delivery })}>
                  <option value="email">{t("newDocument.deliveryEmail")}</option>
                  <option value="link">{t("newDocument.deliveryLink")}</option>
                </Select>
              </Field>
              {recipients.length > 1 && (
                <button type="button" className="justify-self-start text-sm text-danger hover:underline sm:col-span-2" onClick={() => setRecipients((current) => current.filter((_, i) => i !== index))}>
                  {t("common.remove")}
                </button>
              )}
            </div>
          ))}
        </Card>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <ButtonLink href="/documents" variant="secondary">{t("common.cancel")}</ButtonLink>
          <Button type="submit" variant="primary" disabled={saving || !ready}>{saving ? t("common.loading") : t("newDocument.saveDraft")}</Button>
        </div>
      </form>
    </AppShell>
  );
}
