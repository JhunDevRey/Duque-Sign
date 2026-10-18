"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PDFDocument } from "pdf-lib";
import { AppShell } from "@/components/app-shell";
import { useLocalWorkspace } from "@/components/local-workspace";
import { Notice } from "@/components/ui/notice";
import { Button, ButtonLink, IconButton, buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_PAGES } from "@/lib/config/app";
import { formatBytes } from "@/lib/format";
import type { Delivery, DocumentSummary, Recipient } from "@/lib/domain/types";
import { storeOriginalPdf } from "@/lib/preview/local-workspace";
import { sampleViewer } from "@/lib/preview/sample-data";
import { t } from "@/lib/i18n";
import { isSupabaseClientConfigured } from "@/lib/supabase/client";

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
  const [dragging, setDragging] = useState(false);

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

      if (isSupabaseClientConfigured) {
        if (!organizationId) throw new Error("Create an organization before saving documents.");
        const form = new FormData();
        form.set("organizationId", organizationId);
        form.set("title", title.trim());
        form.set("externalId", externalId.trim());
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
        await refresh();
        router.push(`/documents/${result.document.id}`);
        return;
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
        version: 1,
        pageCount,
        createdBy: sampleViewer.name,
        createdAt: now,
        updatedAt: now,
        recipients: savedRecipients,
      };
      await storeOriginalPdf(id, file);
      createDraft(document);
      router.push(`/documents/${id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to validate and save this PDF.");
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <Link href="/documents" className={buttonClass("ghost", "md", "mb-4 -ml-3")}>
        <Icon name="back" />
        {t("common.back")}
      </Link>
      <PageHeader title={t("newDocument.title")} subtitle={isSupabaseClientConfigured ? t("newDocument.cloudSubtitle") : t("newDocument.localSubtitle")} />
      <form onSubmit={submit} className="max-w-3xl space-y-5">
        {error && <Notice tone="danger" title="Unable to save draft">{error}</Notice>}
        {!ready && <Notice>{t("common.loading")}</Notice>}

        <Card className="space-y-5 p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-secondary-container text-title-small text-on-secondary-container">1</span>
            <h2 className="text-title-medium">{t("newDocument.stepUpload")}</h2>
          </div>
          <div>
            <label
              htmlFor="pdf-file"
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                const dropped = event.dataTransfer.files?.[0];
                if (dropped) setFile(dropped);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-6 py-10 text-center transition-colors duration-200",
                dragging ? "border-primary bg-primary-container/60" : file ? "border-success bg-success-container/40" : "border-outline-variant bg-surface-container-low hover:border-outline hover:bg-surface-container",
              )}
            >
              <span className={cn("inline-flex size-12 items-center justify-center rounded-full", file ? "bg-success-container text-on-success-container" : "bg-secondary-container text-on-secondary-container")}>
                <Icon name={file ? "check" : "upload"} className="size-6" />
              </span>
              {file ? (
                <>
                  <span className="max-w-full truncate text-title-medium">{file.name}</span>
                  <span className="text-body-medium text-on-surface-variant">{formatBytes(file.size)} · Click to choose a different file</span>
                </>
              ) : (
                <>
                  <span className="text-title-medium">{t("newDocument.chooseFile")}</span>
                  <span className="text-body-medium text-on-surface-variant">Drag a PDF here, or click to browse</span>
                </>
              )}
              <span className="text-body-small text-on-surface-variant">{t("newDocument.uploadHint", { size: formatBytes(MAX_UPLOAD_BYTES), pages: MAX_UPLOAD_PAGES })}</span>
            </label>
            <input
              id="pdf-file"
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("newDocument.documentTitle")} htmlFor="document-title">
              <Input id="document-title" required value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} />
            </Field>
            <Field label={t("newDocument.externalId")} hint={t("newDocument.externalIdHint")} htmlFor="external-id">
              <Input id="external-id" value={externalId} onChange={(event) => setExternalId(event.target.value)} maxLength={120} />
            </Field>
          </div>
        </Card>

        <Card className="space-y-5 p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary-container text-title-small text-on-secondary-container">2</span>
            <div>
              <h2 className="text-title-medium">{t("newDocument.stepRecipients")}</h2>
              <p className="mt-1 text-body-medium text-on-surface-variant">Recipients are saved in signing order. Email is not sent when a draft is created.</p>
            </div>
          </div>
          {recipients.map((recipient, index) => (
            <div key={index} className="rounded-md border border-outline-variant p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-title-small">
                  <span className="inline-flex size-6 items-center justify-center rounded-full bg-surface-container-highest text-body-small">{index + 1}</span>
                  {recipient.name.trim() || `Recipient ${index + 1}`}
                </p>
                {recipients.length > 1 && (
                  <IconButton
                    label={t("common.remove")}
                    className="-my-2 -mr-2 hover:text-error"
                    onClick={() => setRecipients((current) => current.filter((_, i) => i !== index))}
                  >
                    <Icon name="trash" className="size-[18px]" />
                  </IconButton>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("newDocument.recipientName")} htmlFor={`recipient-name-${index}`}>
                  <Input id={`recipient-name-${index}`} required autoComplete="off" value={recipient.name} onChange={(event) => updateRecipient(index, { name: event.target.value })} />
                </Field>
                <Field label={t("newDocument.recipientEmail")} htmlFor={`recipient-email-${index}`}>
                  <Input id={`recipient-email-${index}`} type="email" required autoComplete="off" value={recipient.email} onChange={(event) => updateRecipient(index, { email: event.target.value })} />
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
              </div>
            </div>
          ))}
          <Button type="button" variant="tonal" onClick={() => setRecipients((current) => [...current, blankRecipient()])}>
            <Icon name="plus" className="size-[18px]" />
            {t("newDocument.addRecipient")}
          </Button>
        </Card>

        <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] -mx-4 flex flex-col-reverse gap-2 bg-surface-container px-4 py-3 sm:static sm:mx-0 sm:flex-row sm:justify-end sm:bg-transparent sm:px-0">
          <ButtonLink href="/documents" variant="secondary" size="lg">{t("common.cancel")}</ButtonLink>
          <Button type="submit" variant="primary" size="lg" disabled={saving || !ready}>{saving ? t("common.loading") : t("newDocument.saveDraft")}</Button>
        </div>
      </form>
    </AppShell>
  );
}
