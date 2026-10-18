"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { SignaturePad } from "@/components/signing/signature-pad";
import { Button, buttonClass } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Textarea } from "@/components/ui/form";
import { BrandMark, Icon, type IconName } from "@/components/ui/icons";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/cn";
import { APP_NAME } from "@/lib/config/app";
import { formatDate, formatDateTime } from "@/lib/format";
import type { SigningField, SigningSession } from "@/lib/signing/session";

type Values = Record<string, string>;

async function readError(response: Response, fallback: string): Promise<string> {
  const result: unknown = await response.json().catch(() => null);
  return typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
    ? result.error
    : fallback;
}

function isFilled(field: SigningField, value: string | undefined): boolean {
  if (!value) return false;
  return field.type === "checkbox" ? value === "true" : value.trim() !== "";
}

const fieldNames: Record<SigningField["type"], string> = {
  signature: "Sign",
  initials: "Initial",
  date: "Date",
  text: "Text",
  checkbox: "Check",
};

function Shell({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="sticky top-0 z-30 bg-surface-container">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
          <BrandMark className="size-8" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-title-medium">{title ?? APP_NAME}</p>
            {title && <p className="truncate text-body-small text-on-surface-variant">{APP_NAME}</p>}
          </div>
          <span className="hidden h-8 items-center gap-2 rounded-sm bg-success-container px-3 text-label-large text-on-success-container sm:inline-flex">
            <Icon name="shield" className="size-4" />
            Secure signing
          </span>
        </div>
      </header>
      {children}
    </div>
  );
}

function StatusScreen({ icon, tone, title, children }: { icon: IconName; tone: "success" | "warning" | "danger" | "accent"; title: string; children: React.ReactNode }) {
  const tones = {
    success: "bg-success-container text-on-success-container",
    warning: "bg-warning-container text-on-warning-container",
    danger: "bg-error-container text-on-error-container",
    accent: "bg-secondary-container text-on-secondary-container",
  };
  return (
    <main className="flex flex-1 items-center justify-center bg-surface-container-low px-4 py-12">
      <div className="animate-rise w-full max-w-md text-center">
        <span className={cn("mx-auto inline-flex size-16 items-center justify-center rounded-full", tones[tone])}>
          <Icon name={icon} className="size-8" />
        </span>
        <h1 className="mt-6 text-headline-medium">{title}</h1>
        <div className="mt-3 space-y-4 text-on-surface-variant">{children}</div>
      </div>
    </main>
  );
}

/** Renders every PDF page stacked, sized to the container, with an overlay slot per page. */
function PdfPages({
  url,
  overlay,
  onError,
}: {
  url: string;
  overlay: (page: number) => React.ReactNode;
  onError: (message: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [width, setWidth] = useState(0);
  const [sizes, setSizes] = useState<Array<{ width: number; height: number }>>([]);
  const canvases = useRef<Array<HTMLCanvasElement | null>>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => setWidth(Math.floor(entries[0]?.contentRect.width ?? 0)));
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => Promise<void>) | null = null;
    (async () => {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error(await readError(response, "Unable to load the document."));
        const bytes = new Uint8Array(await response.arrayBuffer());
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
        const task = pdfjs.getDocument({ data: bytes });
        destroy = () => task.destroy();
        const loaded = await task.promise;
        if (cancelled) return;
        setPdf(loaded);
      } catch (cause) {
        if (!cancelled) onError(cause instanceof Error ? cause.message : "Unable to load the document.");
      }
    })();
    return () => {
      cancelled = true;
      if (destroy) void destroy();
    };
  }, [url, onError]);

  useEffect(() => {
    if (!pdf || !width) return;
    let cancelled = false;
    const tasks: Array<{ cancel: () => void }> = [];
    (async () => {
      const nextSizes: Array<{ width: number; height: number }> = [];
      for (let index = 1; index <= pdf.numPages; index += 1) {
        const page = await pdf.getPage(index);
        const base = page.getViewport({ scale: 1 });
        const scale = width / base.width;
        nextSizes.push({ width, height: base.height * scale });
      }
      if (cancelled) return;
      setSizes(nextSizes);
      // Render after layout so the canvases exist.
      requestAnimationFrame(async () => {
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        for (let index = 1; index <= pdf.numPages; index += 1) {
          if (cancelled) return;
          const canvas = canvases.current[index - 1];
          const context = canvas?.getContext("2d");
          if (!canvas || !context) continue;
          const page = await pdf.getPage(index);
          const viewport = page.getViewport({ scale: (width / page.getViewport({ scale: 1 }).width) * ratio });
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const task = page.render({ canvas, canvasContext: context, viewport });
          tasks.push(task);
          await task.promise.catch(() => undefined);
        }
      });
    })();
    return () => {
      cancelled = true;
      for (const task of tasks) task.cancel();
    };
  }, [pdf, width]);

  return (
    <div ref={containerRef} className="mx-auto w-full max-w-[860px] space-y-4">
      {!pdf && <div className="aspect-[8.5/11] w-full animate-pulse rounded-sm bg-surface-container-high" />}
      {pdf && sizes.map((size, index) => (
        <div key={index} className="pdf-page relative overflow-hidden rounded-xs" style={{ width: size.width, height: size.height }}>
          <canvas ref={(element) => { canvases.current[index] = element; }} className="absolute inset-0 size-full" />
          {overlay(index + 1)}
        </div>
      ))}
    </div>
  );
}

export default function SignPage() {
  const { token } = useParams<{ token: string }>();
  const [session, setSession] = useState<SigningSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [consent, setConsent] = useState(false);
  const [values, setValues] = useState<Values>({});
  const [adopted, setAdopted] = useState<{ signature?: string; initials?: string }>({});
  const [padFor, setPadFor] = useState<SigningField | null>(null);
  const [textFor, setTextFor] = useState<SigningField | null>(null);
  const [textDraft, setTextDraft] = useState("");
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [result, setResult] = useState<"signed" | "completed" | "declined" | null>(null);

  const apiBase = `/api/sign/${encodeURIComponent(token)}`;

  useEffect(() => {
    let active = true;
    fetch(apiBase, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response, "Unable to open this document."));
        const loaded = (await response.json()) as SigningSession;
        if (active) setSession(loaded);
      })
      .catch((cause: unknown) => {
        if (active) setLoadError(cause instanceof Error ? cause.message : "Unable to open this document.");
      });
    return () => {
      active = false;
    };
  }, [apiBase]);

  const fields = useMemo(() => session?.fields ?? [], [session]);
  const required = fields.filter((field) => field.required);
  const completedRequired = required.filter((field) => isFilled(field, values[field.id])).length;
  const allDone = completedRequired === required.length;
  const nextField = fields.find((field) => field.required && !isFilled(field, values[field.id]));
  const handlePdfError = useCallback((message: string) => setPdfError(message), []);

  function scrollToField(field: SigningField | undefined) {
    if (!field) return;
    document.getElementById(`field-${field.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function setValue(field: SigningField, value: string) {
    const next = { ...values, [field.id]: value };
    setValues(next);
    // Move the signer along to the next empty required field.
    const following = fields.find((entry) => entry.required && entry.id !== field.id && !isFilled(entry, next[entry.id]));
    if (following && isFilled(field, value)) setTimeout(() => scrollToField(following), 250);
  }

  function activate(field: SigningField) {
    setActionError(null);
    if (field.type === "signature" || field.type === "initials") {
      const existing = adopted[field.type];
      if (existing && !values[field.id]) setValue(field, existing);
      else setPadFor(field);
    } else if (field.type === "date") {
      setValue(field, values[field.id] ? "" : formatDate(new Date().toISOString()));
    } else if (field.type === "checkbox") {
      setValue(field, values[field.id] === "true" ? "false" : "true");
    } else {
      setTextDraft(values[field.id] ?? "");
      setTextFor(field);
    }
  }

  async function submit() {
    if (!session) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const filled = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ""));
      const response = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sign", consent, values: filled }),
      });
      if (!response.ok) throw new Error(await readError(response, "Unable to save your signature."));
      const outcome = (await response.json()) as { completed: boolean };
      setResult(outcome.completed ? "completed" : "signed");
      window.scrollTo({ top: 0 });
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Unable to save your signature.");
    } finally {
      setSubmitting(false);
    }
  }

  async function decline() {
    setSubmitting(true);
    setActionError(null);
    try {
      const response = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline", reason: declineReason }),
      });
      if (!response.ok) throw new Error(await readError(response, "Unable to decline this document."));
      setDeclining(false);
      setResult("declined");
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Unable to decline this document.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <Shell>
        <StatusScreen icon="link" tone="warning" title="Link unavailable">
          <p>{loadError}</p>
        </StatusScreen>
      </Shell>
    );
  }
  if (!session) {
    return (
      <Shell>
        <main className="flex flex-1 flex-col items-center justify-center gap-4 text-body-medium text-on-surface-variant" role="status">
          <span className="size-12 animate-spin rounded-full border-4 border-secondary-container border-t-primary" aria-hidden="true" />
          Opening your document…
        </main>
      </Shell>
    );
  }

  const { document: doc, recipient } = session;
  const firstName = recipient.name.split(/\s+/)[0];
  const downloadLink = (
    <a
      href={`${apiBase}/pdf?download=1`}
      className={buttonClass("primary", "md")}
    >
      <Icon name="download" className="size-[18px]" />
      Download signed PDF
    </a>
  );

  if (result === "completed" || (!result && session.state === "completed")) {
    return (
      <Shell title={doc.title}>
        <StatusScreen icon="check" tone="success" title="All signed">
          <p>Everyone has signed <span className="text-on-surface">{doc.title}</span>. The final PDF includes a signing certificate.</p>
          {(result === "completed" || doc.hasFinalPdf) && <div className="pt-2">{downloadLink}</div>}
        </StatusScreen>
      </Shell>
    );
  }
  if (result === "signed" || session.state === "signed") {
    return (
      <Shell title={doc.title}>
        <StatusScreen icon="check" tone="success" title={`Thanks, ${firstName}`}>
          <p>Your signature on <span className="text-on-surface">{doc.title}</span> is saved.</p>
          <p className="text-body-medium">You can open this link again later to download the final PDF once everyone has signed.</p>
        </StatusScreen>
      </Shell>
    );
  }
  if (result === "declined" || session.state === "declined") {
    return (
      <Shell title={doc.title}>
        <StatusScreen icon="ban" tone="danger" title="You declined to sign">
          <p>The sender has been notified in their dashboard. No further action is needed.</p>
        </StatusScreen>
      </Shell>
    );
  }
  if (session.state === "expired") {
    return (
      <Shell title={doc.title}>
        <StatusScreen icon="clock" tone="warning" title="This link has expired">
          <p>Ask the sender to send the document again.</p>
        </StatusScreen>
      </Shell>
    );
  }
  if (session.state === "closed") {
    return (
      <Shell title={doc.title}>
        <StatusScreen icon="ban" tone="warning" title="No longer available">
          <p>This document was cancelled or closed by the sender.</p>
        </StatusScreen>
      </Shell>
    );
  }

  const waiting = session.state === "waiting";

  if (!started) {
    return (
      <Shell title={doc.title}>
        <main className="flex flex-1 items-start justify-center bg-surface-container-low px-4 py-8 sm:items-center sm:py-12">
          <div className="animate-rise w-full max-w-lg">
            <h1 className="text-headline-large sm:text-display-small">
              Hi {firstName},
            </h1>
            <p className="mt-3 text-title-medium text-on-surface-variant">
              {waiting ? "This document is on its way to you." : "You've been asked to review and sign a document."}
            </p>

            <div className="mt-8 rounded-2xl bg-surface p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-lg bg-secondary-container text-on-secondary-container">
                  <Icon name="document" className="size-6" />
                </span>
                <div className="min-w-0">
                  <p className="text-title-large">{doc.title}</p>
                  <p className="mt-1 text-body-medium text-on-surface-variant">
                    {doc.pageCount} {doc.pageCount === 1 ? "page" : "pages"}
                    {fields.length > 0 && ` · ${fields.length} ${fields.length === 1 ? "field" : "fields"} for you`}
                  </p>
                  {doc.expiresAt && <p className="mt-0.5 text-body-small text-on-surface-variant">Sign by {formatDateTime(doc.expiresAt)}</p>}
                </div>
              </div>

              {session.signers.length > 1 && (
                <ol className="mt-5 space-y-2 border-t border-outline-variant pt-5">
                  {session.signers.map((signer) => (
                    <li key={`${signer.order}-${signer.name}`} className="flex items-center gap-3 text-body-medium">
                      <span className={cn(
                        "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-body-small font-medium",
                        signer.status === "signed" ? "bg-success-container text-on-success-container" : signer.isYou ? "bg-secondary-container text-on-secondary-container" : "bg-surface-container-high text-on-surface-variant",
                      )}>
                        {signer.status === "signed" ? <Icon name="check" className="size-4" /> : signer.order}
                      </span>
                      <span className={cn("min-w-0 flex-1 truncate", signer.isYou && "font-medium")}>{signer.isYou ? `${signer.name} (you)` : signer.name}</span>
                      <span className="text-body-small text-on-surface-variant">{signer.status === "signed" ? "Signed" : signer.isYou ? "Your turn" : "Waiting"}</span>
                    </li>
                  ))}
                </ol>
              )}

              {waiting ? (
                <Notice tone="accent" className="mt-5" title="Waiting for earlier signers">
                  You can review the document now. Signing opens once the people before you have signed.
                </Notice>
              ) : (
                <div className="mt-5 rounded-md bg-surface-container p-4">
                  <Checkbox
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                    label={
                      <span className="text-body-medium">
                        I agree to use electronic records and signatures for this document, and that my electronic
                        signature is the legal equivalent of my handwritten signature.
                      </span>
                    }
                  />
                </div>
              )}

              <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
                <Button variant="primary" size="lg" className="sm:flex-1" disabled={!waiting && !consent} onClick={() => setStarted(true)}>
                  {waiting ? "Review document" : "Continue"}
                  <Icon name="chevronRight" className="size-[18px]" />
                </Button>
                <Button variant="ghost" size="lg" onClick={() => setDeclining(true)} className="text-error">
                  Decline
                </Button>
              </div>
            </div>
            <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-body-small text-on-surface-variant">
              <Icon name="shield" className="size-4" />
              Sent to {recipient.email}. Your views and signature are recorded in an audit log.
            </p>
          </div>
        </main>
        <DeclineDialog
          open={declining}
          reason={declineReason}
          setReason={setDeclineReason}
          submitting={submitting}
          error={actionError}
          onClose={() => setDeclining(false)}
          onConfirm={decline}
        />
      </Shell>
    );
  }

  return (
    <Shell title={doc.title}>
      <div className="sticky top-16 z-20 border-b border-outline-variant bg-surface-container">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
          {waiting ? (
            <p className="flex-1 text-body-medium text-on-surface-variant">Review only — signing opens after earlier signers finish.</p>
          ) : (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-title-small">{allDone ? "Ready to finish" : `${completedRequired} of ${required.length} required fields`}</p>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-secondary-container">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500 ease-emphasized"
                    style={{ width: `${required.length ? (completedRequired / required.length) * 100 : 100}%` }}
                  />
                </div>
              </div>
              {!allDone && (
                <Button variant="tonal" size="sm" onClick={() => scrollToField(nextField)}>
                  Next field
                  <Icon name="chevronRight" className="size-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <main className="flex-1 px-3 pt-4 pb-36 sm:px-6 sm:pt-6">
        {pdfError && <Notice tone="danger" className="mx-auto mb-4 max-w-[860px]">{pdfError}</Notice>}
        <PdfPages
          url={`${apiBase}/pdf`}
          onError={handlePdfError}
          overlay={(page) => fields.filter((field) => field.page === page).map((field) => {
            const value = values[field.id];
            const filled = isFilled(field, value);
            return (
              <button
                key={field.id}
                id={`field-${field.id}`}
                type="button"
                disabled={waiting}
                onClick={() => activate(field)}
                aria-label={`${fieldNames[field.type]}${field.label ? `: ${field.label}` : ""}${field.required ? " (required)" : ""}${filled ? ", completed" : ""}`}
                className={cn(
                  "absolute flex items-center justify-center overflow-hidden rounded-xs border-2 text-on-pdf-field-container transition-[background-color,box-shadow]",
                  filled
                    ? "border-transparent bg-transparent hover:border-pdf-field/50"
                    : field.required
                      ? "animate-pulse border-pdf-field bg-pdf-field-container/80 shadow-[0_0_0_4px_rgb(34_100_136/0.15)] hover:animate-none"
                      : "border-dashed border-pdf-field/60 bg-pdf-field-container/45",
                  waiting && "cursor-default opacity-60",
                )}
                style={{ left: `${field.x * 100}%`, top: `${field.y * 100}%`, width: `${field.w * 100}%`, height: `${field.h * 100}%` }}
              >
                {filled && (field.type === "signature" || field.type === "initials") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={value} alt="" className="size-full object-contain" />
                ) : filled && field.type === "checkbox" ? (
                  <Icon name="check" className="size-[80%] text-pdf-ink" />
                ) : filled ? (
                  <span className="truncate px-1 text-[clamp(8px,1.6vw,14px)] text-pdf-ink">{value}</span>
                ) : field.type === "checkbox" ? (
                  <span className="sr-only">{fieldNames.checkbox}</span>
                ) : (
                  <span className="flex items-center gap-1 truncate px-1 text-[clamp(8px,1.5vw,12px)] font-medium">
                    {field.type === "signature" && <Icon name="pen" className="size-[1.2em]" />}
                    {field.label || fieldNames[field.type]}
                    {field.required && <span aria-hidden="true">*</span>}
                  </span>
                )}
              </button>
            );
          })}
        />
      </main>

      {!waiting && (
        <div className="fixed inset-x-0 bottom-0 z-30 bg-surface-container shadow-elevation-2">
          <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center">
            {actionError ? (
              <p role="alert" className="flex-1 text-body-medium text-error">{actionError}</p>
            ) : (
              <p className="hidden flex-1 text-body-medium text-on-surface-variant sm:block">
                {allDone ? "All set. Finish to sign the document." : "Tap each highlighted field to fill it in."}
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setDeclining(true)} className="text-error">Decline</Button>
              <Button variant="primary" size="lg" className="flex-1 sm:flex-none" disabled={!allDone || submitting} onClick={submit}>
                <Icon name="check" className="size-[18px]" />
                {submitting ? "Signing…" : "Finish signing"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {padFor && (
        <SignaturePad
          key={padFor.type}
          open
          kind={padFor.type === "initials" ? "initials" : "signature"}
          defaultName={recipient.name}
          onClose={() => setPadFor(null)}
          onAdopt={(dataUrl) => {
            const kind = padFor.type === "initials" ? "initials" : "signature";
            setAdopted((current) => ({ ...current, [kind]: dataUrl }));
            setValue(padFor, dataUrl);
            setPadFor(null);
          }}
        />
      )}

      <Dialog open={textFor !== null} onClose={() => setTextFor(null)} title={textFor?.label || "Enter text"}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (textFor) setValue(textFor, textDraft.trim());
            setTextFor(null);
          }}
        >
          <Textarea aria-label={textFor?.label || "Text"} value={textDraft} maxLength={500} onChange={(event) => setTextDraft(event.target.value)} data-autofocus className="min-h-24" />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setTextFor(null)}>Cancel</Button>
            <Button type="submit" variant="primary">Done</Button>
          </div>
        </form>
      </Dialog>

      <DeclineDialog
        open={declining}
        reason={declineReason}
        setReason={setDeclineReason}
        submitting={submitting}
        error={actionError}
        onClose={() => setDeclining(false)}
        onConfirm={decline}
      />
    </Shell>
  );
}

function DeclineDialog({
  open,
  reason,
  setReason,
  submitting,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  reason: string;
  setReason: (value: string) => void;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Decline to sign?">
      <div className="space-y-4">
        <p className="text-body-medium text-on-surface-variant">The sender will see that you declined. Signing links for everyone on this document will stop working.</p>
        <Textarea
          aria-label="Reason (optional)"
          placeholder="Reason (optional)"
          value={reason}
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
        />
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Keep reviewing</Button>
          <Button variant="danger" onClick={onConfirm} disabled={submitting}>{submitting ? "Declining…" : "Decline"}</Button>
        </div>
      </div>
    </Dialog>
  );
}
