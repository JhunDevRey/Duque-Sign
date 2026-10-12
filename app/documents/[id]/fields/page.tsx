"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { AppShell } from "@/components/app-shell";
import { useLocalWorkspace } from "@/components/local-workspace";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field as FormField, Input, Select } from "@/components/ui/form";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { isFirebaseClientConfigured } from "@/lib/firebase/client";
import { FIELD_TYPES, type DocumentSummary, type Field, type FieldType } from "@/lib/domain/types";
import { readOriginalPdf } from "@/lib/preview/local-workspace";
import { SAMPLE_PDF_URL } from "@/lib/preview/sample-data";
import { t } from "@/lib/i18n";

type AnchorMatch = {
  type: FieldType;
  role: string;
  label: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

const FIELD_SIZES: Record<FieldType, { w: number; h: number }> = {
  signature: { w: 0.24, h: 0.075 },
  initials: { w: 0.12, h: 0.055 },
  date: { w: 0.16, h: 0.05 },
  text: { w: 0.25, h: 0.06 },
  checkbox: { w: 0.045, h: 0.045 },
};
const MAX_FIELDS = 100;

const ANCHOR_TYPES: Record<string, FieldType> = {
  s: "signature",
  i: "initials",
  d: "date",
  c: "checkbox",
  t: "text",
};

function constrain(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function fieldLabel(field: Field): string {
  if (field.source === "anchor" && field.label) {
    const match = /^\{\{\s*[sidct]\s*:\s*(.+?)\s*\}\}$/i.exec(field.label);
    return match ? `${t(`fieldTypes.${field.type}`)} (${match[1]})` : t(`fieldTypes.${field.type}`);
  }
  return field.label || t(`fieldTypes.${field.type}`);
}

export default function DocumentFieldsPage() {
  const { id } = useParams<{ id: string }>();
  const { documents, updateDocument, ready, organizationId, refresh } = useLocalWorkspace();
  const document = documents.find((entry) => entry.id === id);

  if (!ready) return <AppShell><p className="text-sm text-muted">{t("common.loading")}</p></AppShell>;
  if (!document) {
    return <AppShell><Notice tone="warning" title={t("notFound.title")}>{t("documents.notFound")}</Notice></AppShell>;
  }
  if (document.status !== "draft") {
    return (
      <AppShell>
        <Notice tone="warning" title={t("editor.lockedTitle")}>{t("editor.lockedMessage")}</Notice>
        <Link href={`/documents/${document.id}`} className="mt-4 inline-flex text-sm text-accent hover:underline">← {t("common.back")}</Link>
      </AppShell>
    );
  }

  return (
    <DocumentFieldsEditor
      key={document.id}
      document={document}
      organizationId={organizationId}
      updateDocument={updateDocument}
      refresh={refresh}
    />
  );
}

function DocumentFieldsEditor({
  document,
  organizationId,
  updateDocument,
  refresh,
}: {
  document: DocumentSummary;
  organizationId: string | null;
  updateDocument: (id: string, update: Partial<DocumentSummary>) => void;
  refresh: () => Promise<void>;
}) {
  const documentId = document.id;
  const originalFileName = document.originalFileName;
  const originalPdfStorage = document.originalPdfStorage;
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeType, setActiveType] = useState<FieldType>("signature");
  const [fields, setFields] = useState<Field[]>(() => document.fields ?? []);
  const [activeRecipientId, setActiveRecipientId] = useState(() => document.recipients[0]?.id ?? "");
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const dragRef = useRef<{ fieldId: string; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let destroyLoadingTask: (() => Promise<void>) | null = null;
    async function loadPdf() {
      setLoading(true);
      setError(null);
      try {
        let bytes: ArrayBuffer;
        if (!originalFileName) {
          const response = await fetch(SAMPLE_PDF_URL);
          if (!response.ok) throw new Error("Unable to load the sample PDF.");
          bytes = await response.arrayBuffer();
        } else if (originalPdfStorage === "browser") {
          const blob = await readOriginalPdf(documentId);
          if (!blob) throw new Error("This draft's PDF is only available in the browser and device where it was uploaded.");
          bytes = await blob.arrayBuffer();
        } else if (isFirebaseClientConfigured) {
          if (!organizationId) throw new Error("No organization is selected.");
          const response = await fetch(
            `/api/documents/${encodeURIComponent(documentId)}/file?organizationId=${encodeURIComponent(organizationId)}`,
            { cache: "no-store" },
          );
          if (!response.ok) throw new Error("Unable to load the original PDF. Confirm Cloud Storage is configured.");
          bytes = await response.arrayBuffer();
        } else {
          const blob = await readOriginalPdf(documentId);
          if (!blob) throw new Error("Original PDF is missing from this browser workspace.");
          bytes = await blob.arrayBuffer();
        }
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
        const loadingTask = pdfjs.getDocument({ data: new Uint8Array(bytes) });
        destroyLoadingTask = () => loadingTask.destroy();
        const loadedPdf = await loadingTask.promise;
        if (!cancelled) {
          setPdf(loadedPdf);
          setPageNumber(1);
        } else {
          await loadingTask.destroy();
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to open the PDF.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadPdf();
    return () => {
      cancelled = true;
      if (destroyLoadingTask) void destroyLoadingTask();
    };
  }, [documentId, originalFileName, originalPdfStorage, organizationId]);

  useEffect(() => {
    if (!pdf) return;
    const currentPdf = pdf;
    let cancelled = false;
    async function renderPage() {
      try {
        renderTaskRef.current?.cancel();
        const page = await currentPdf.getPage(pageNumber);
        if (cancelled) return;
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(1.5, Math.max(0.5, (containerWidth - 24) / baseViewport.width || 1));
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) throw new Error("PDF canvas is unavailable in this browser.");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        setPageSize({ width: viewport.width, height: viewport.height });
        const renderTask = page.render({ canvas, canvasContext: context, viewport });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (cause) {
        if (!cancelled && !(cause instanceof Error && cause.name === "RenderingCancelledException")) {
          setError(cause instanceof Error ? cause.message : "Unable to render this PDF page.");
        }
      }
    }
    void renderPage();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [pdf, pageNumber, containerWidth]);

  const addField = useCallback((x: number, y: number, type = activeType, recipientId = activeRecipientId, source: Field["source"] = "manual", label?: string) => {
    if (!document || !recipientId) return;
    if (fields.length >= MAX_FIELDS) {
      setError(t("editor.fieldLimit", { count: MAX_FIELDS }));
      return;
    }
    const size = FIELD_SIZES[type];
    const field: Field = {
      id: `fld_${crypto.randomUUID()}`,
      type,
      recipientId,
      page: pageNumber,
      x: constrain(x, 0, 1 - size.w),
      y: constrain(y, 0, 1 - size.h),
      w: size.w,
      h: size.h,
      required: true,
      source,
      label,
    };
    setFields((current) => [...current, field]);
    setSelectedFieldId(field.id);
    setNotice(null);
  }, [activeRecipientId, activeType, document, fields.length, pageNumber]);

  async function detectAnchors() {
    if (!pdf || document.status !== "draft") return;
    setError(null);
    setNotice(null);
    try {
      const matches: AnchorMatch[] = [];
      const unmatchedRoles = new Set<string>();
      const pattern = /\{\{\s*([sidct])\s*:\s*([^{}]+?)\s*\}\}/gi;
      for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
        const page = await pdf.getPage(pageIndex);
        const viewport = page.getViewport({ scale: 1 });
        const textContent = await page.getTextContent();
        for (const item of textContent.items) {
          if (!("str" in item) || typeof item.str !== "string" || !item.str.includes("{{")) continue;
          pattern.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = pattern.exec(item.str)) !== null) {
            const role = match[2].trim();
            const recipient = document.recipients.find((entry) => entry.role.toLocaleLowerCase() === role.toLocaleLowerCase());
            if (!recipient) {
              unmatchedRoles.add(role);
              continue;
            }
            const transform = item.transform;
            const [baseX, baseY] = viewport.convertToViewportPoint(transform[4], transform[5]);
            const textWidth = item.width * viewport.scale;
            const textHeight = item.height * viewport.scale;
            const top = Math.max(0, baseY - textHeight);
            const x = Math.max(0, baseX + textWidth * (match.index / Math.max(1, item.str.length)));
            const size = FIELD_SIZES[ANCHOR_TYPES[match[1].toLocaleLowerCase()]];
            matches.push({
              type: ANCHOR_TYPES[match[1].toLocaleLowerCase()],
              role,
              label: match[0].trim(),
              page: pageIndex,
              x: x / viewport.width,
              y: top / viewport.height,
              w: Math.min(0.98, Math.max(size.w, textWidth * (match[0].length / item.str.length) / viewport.width + 0.01)),
              h: Math.min(0.98, Math.max(size.h, textHeight / viewport.height + 0.015)),
            });
          }
        }
      }

      const existingAnchors = new Set(
        fields.filter((field) => field.source === "anchor").map((field) => `${field.page}:${field.label}`),
      );
      const newFields: Field[] = matches
        .filter((match) => !existingAnchors.has(`${match.page}:${match.label}`))
        .map((match) => {
          const recipient = document.recipients.find((entry) => entry.role.toLocaleLowerCase() === match.role.toLocaleLowerCase());
          if (!recipient) throw new Error("Anchor recipient changed while scanning.");
          return {
            id: `fld_${crypto.randomUUID()}`,
            type: match.type,
            recipientId: recipient.id,
            page: match.page,
            x: constrain(match.x, 0, 1 - match.w),
            y: constrain(match.y, 0, 1 - match.h),
            w: match.w,
            h: match.h,
            required: true,
            source: "anchor",
            label: match.label,
          };
        });
      if (fields.length + newFields.length > MAX_FIELDS) {
        throw new Error(t("editor.fieldLimit", { count: MAX_FIELDS }));
      }
      setFields((current) => [...current, ...newFields]);
      const messages: string[] = [];
      if (newFields.length) messages.push(t("editor.anchorsFound", { count: newFields.length }));
      else if (!matches.length) messages.push(t("editor.anchorsNone"));
      else messages.push(t("editor.noNewAnchors"));
      if (unmatchedRoles.size) {
        messages.push(t("editor.anchorsUnmatched", { count: unmatchedRoles.size, roles: [...unmatchedRoles].join(", ") }));
      }
      setNotice(messages.join(" "));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to scan PDF text for anchors.");
    }
  }

  async function saveFields() {
    if (!document || document.status !== "draft") return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (isFirebaseClientConfigured) {
        if (!organizationId) throw new Error("No organization is selected.");
        const response = await fetch(`/api/documents/${encodeURIComponent(document.id)}/fields`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId, fields }),
        });
        const result: unknown = await response.json();
        if (!response.ok) {
          const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
            ? result.error
            : "Unable to save fields.";
          throw new Error(message);
        }
        await refresh();
      } else {
        updateDocument(document.id, { fields, updatedAt: new Date().toISOString() });
      }
      setNotice(t("editor.fieldsSaved"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save document fields.");
    } finally {
      setSaving(false);
    }
  }

  function placeField(event: MouseEvent<HTMLDivElement>) {
    if (document.status !== "draft" || !pageSize.width || !pageSize.height) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    addField(x, y);
  }

  function moveField(event: MouseEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const pageBounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!pageBounds?.width || !pageBounds.height) return;
    const x = (event.clientX - pageBounds.left - drag.offsetX) / pageBounds.width;
    const y = (event.clientY - pageBounds.top - drag.offsetY) / pageBounds.height;
    setFields((current) => current.map((field) => field.id === drag.fieldId
      ? { ...field, x: constrain(x, 0, 1 - field.w), y: constrain(y, 0, 1 - field.h) }
      : field));
  }

  const selectedField = fields.find((field) => field.id === selectedFieldId);

  return (
    <AppShell>
      <PageHeader title={`${t("editor.fields")}: ${document.title}`} subtitle={t("editor.clickToPlace")} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href={`/documents/${document.id}`} className="inline-flex h-10 items-center rounded-md px-3 text-sm text-accent hover:bg-surface-muted">← {t("common.back")}</Link>
        <Button variant="secondary" onClick={detectAnchors} disabled={!pdf || loading}>{t("editor.detectAnchors")}</Button>
        <Button variant="primary" onClick={saveFields} disabled={saving}>{saving ? t("common.loading") : t("common.save")}</Button>
      </div>
      {error && <Notice tone="danger" className="mb-4">{error}</Notice>}
      {notice && <Notice tone="success" className="mb-4">{notice}</Notice>}
      {document.originalPdfStorage === "browser" && (
        <Notice tone="warning" className="mb-4">{t("editor.localPdfNotice")}</Notice>
      )}
      {isFirebaseClientConfigured && document.originalPdfStorage !== "browser" && (
        <Notice tone="warning" className="mb-4">{t("editor.storageBillingNotice")}</Notice>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="min-w-0 p-3 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium">{t("common.pageOf", { page: pageNumber, total: pdf?.numPages ?? document.pageCount })}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={pageNumber <= 1} onClick={() => setPageNumber((page) => page - 1)}>{t("common.pagePrevious")}</Button>
              <Button size="sm" variant="secondary" disabled={!pdf || pageNumber >= pdf.numPages} onClick={() => setPageNumber((page) => page + 1)}>{t("common.pageNext")}</Button>
            </div>
          </div>
          <div ref={containerRef} className="overflow-auto rounded-md bg-surface-muted p-2 sm:p-3">
            {loading ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted">{t("common.loading")}</div>
            ) : error && !pdf ? (
              <p className="p-6 text-sm text-danger">{error}</p>
            ) : (
              <div
                className="pdf-page relative mx-auto cursor-crosshair"
                style={{ width: pageSize.width || undefined, height: pageSize.height || undefined }}
                onClick={placeField}
              >
                <canvas ref={canvasRef} className="block" />
                {fields.filter((field) => field.page === pageNumber).map((field) => {
                  const recipient = document.recipients.find((entry) => entry.id === field.recipientId);
                  return (
                    <button
                      key={field.id}
                      type="button"
                      title={`${fieldLabel(field)} — ${recipient?.name ?? "Unknown recipient"}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedFieldId(field.id);
                      }}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                        setSelectedFieldId(field.id);
                        const bounds = event.currentTarget.getBoundingClientRect();
                        dragRef.current = {
                          fieldId: field.id,
                          offsetX: event.clientX - bounds.left,
                          offsetY: event.clientY - bounds.top,
                        };
                        event.currentTarget.setPointerCapture(event.pointerId);
                      }}
                      onPointerMove={moveField}
                      onPointerUp={() => { dragRef.current = null; }}
                      onPointerCancel={() => { dragRef.current = null; }}
                      className={`absolute overflow-hidden rounded border-2 px-1 text-left text-[9px] leading-tight shadow-sm sm:text-[10px] ${
                        selectedFieldId === field.id
                          ? "z-10 border-accent bg-accent-soft/95 text-accent"
                          : "border-accent/60 bg-white/95 text-foreground"
                      }`}
                      style={{
                        left: `${field.x * 100}%`,
                        top: `${field.y * 100}%`,
                        width: `${field.w * 100}%`,
                        height: `${field.h * 100}%`,
                        touchAction: "none",
                        cursor: "move",
                      }}
                    >
                      <span className="block truncate font-medium">{fieldLabel(field)}</span>
                      <span className="block truncate text-muted">{recipient?.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        <aside className="space-y-5">
          <Card className="space-y-4 p-4">
            <h2 className="font-semibold">{t("editor.fields")}</h2>
            <FormField label={t("editor.assignTo")} htmlFor="field-recipient">
              <Select id="field-recipient" value={activeRecipientId} onChange={(event) => setActiveRecipientId(event.target.value)}>
                {document.recipients.map((recipient) => (
                  <option key={recipient.id} value={recipient.id}>{recipient.name} ({recipient.role})</option>
                ))}
              </Select>
            </FormField>
            <FormField label={t("editor.fields")} htmlFor="field-type">
              <Select id="field-type" value={activeType} onChange={(event) => setActiveType(event.target.value as FieldType)}>
                {FIELD_TYPES.map((type) => <option key={type} value={type}>{t(`fieldTypes.${type}`)}</option>)}
              </Select>
            </FormField>
            <p className="text-xs text-muted">{t("editor.clickToPlace")}</p>
            <div className="max-h-72 space-y-2 overflow-auto">
              {fields.length ? fields.map((field) => {
                const recipient = document.recipients.find((entry) => entry.id === field.recipientId);
                return (
                  <div key={field.id} className={`rounded-md border p-2 ${selectedFieldId === field.id ? "border-accent" : "border-border"}`}>
                    <button type="button" className="w-full text-left" onClick={() => { setSelectedFieldId(field.id); setPageNumber(field.page); }}>
                      <span className="block truncate text-sm font-medium">{fieldLabel(field)}</span>
                      <span className="text-xs text-muted">{recipient?.name} · {t("common.page", { page: field.page })} · {field.source === "anchor" ? t("editor.fromAnchor") : t("editor.fields")}</span>
                    </button>
                    <button type="button" className="mt-1 text-xs text-danger hover:underline" onClick={() => setFields((current) => current.filter((item) => item.id !== field.id))}>
                      {t("common.delete")}
                    </button>
                  </div>
                );
              }) : <p className="text-sm text-muted">{t("editor.noSelection")}</p>}
            </div>
            <p className="text-xs text-muted">{t("editor.fieldCount", { count: fields.length })}</p>
          </Card>

          {selectedField && (
            <Card className="space-y-3 p-4">
              <h2 className="font-semibold">{t("editor.selectedField")}</h2>
              <FormField label={t("editor.label")} htmlFor="field-label">
                <Input
                  id="field-label"
                  maxLength={160}
                  disabled={selectedField.source === "anchor"}
                  value={
                    selectedField.source === "anchor"
                      ? /^\{\{\s*[sidct]\s*:\s*(.+?)\s*\}\}$/i.exec(selectedField.label ?? "")?.[1] ?? fieldLabel(selectedField)
                      : selectedField.label ?? ""
                  }
                  onChange={(event) => setFields((current) => current.map((field) => field.id === selectedField.id ? { ...field, label: event.target.value } : field))}
                />
              </FormField>
              <FormField label={t("editor.assignTo")} htmlFor="selected-field-recipient">
                <Select id="selected-field-recipient" value={selectedField.recipientId} onChange={(event) => setFields((current) => current.map((field) => field.id === selectedField.id ? { ...field, recipientId: event.target.value } : field))}>
                  {document.recipients.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.name} ({recipient.role})</option>)}
                </Select>
              </FormField>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selectedField.required} onChange={(event) => setFields((current) => current.map((field) => field.id === selectedField.id ? { ...field, required: event.target.checked } : field))} />
                {t("common.required")}
              </label>
              <p className="text-xs text-muted">{selectedField.source === "anchor" ? t("editor.fromAnchor") : t("editor.manualFieldHint")}</p>
            </Card>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
