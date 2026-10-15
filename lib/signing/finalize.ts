import "server-only";

import { createHash } from "node:crypto";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { DISPLAY_TIME_ZONE } from "@/lib/config/app";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ORIGINAL_PDF_BUCKET } from "@/lib/supabase/documents";

export const SIGNED_PDF_BUCKET = "signed-pdfs";

export type FinalizationPayload = {
  organizationId: string;
  version: number;
  originalPdfPath: string | null;
  title: string;
  fields: Array<{ type: string; page: number; x: number; y: number; w: number; h: number; value: string }>;
  signers: Array<{ name: string; email: string; signedAt: string | null }>;
};

export function signedPdfPath(organizationId: string, documentId: string, version: number): string {
  return `${organizationId}/${documentId}/v${version}/signed.pdf`;
}

/** Replaces characters the standard PDF fonts cannot encode, so names in any script still render. */
function encodable(font: PDFFont, text: string): string {
  return [...text].map((character) => {
    try {
      font.encodeText(character);
      return character;
    } catch {
      return "?";
    }
  }).join("");
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return "—";
  return `${new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "long",
    timeZone: DISPLAY_TIME_ZONE,
  }).format(new Date(iso))}`;
}

function drawFittedText(page: PDFPage, font: PDFFont, text: string, box: { x: number; y: number; w: number; h: number }) {
  const safe = encodable(font, text);
  let size = Math.min(12, box.h * 0.7);
  while (size > 5 && font.widthOfTextAtSize(safe, size) > box.w - 4) size -= 0.5;
  page.drawText(safe, {
    x: box.x + 2,
    y: box.y + (box.h - font.heightAtSize(size)) / 2 + font.heightAtSize(size) * 0.22,
    size,
    font,
    color: rgb(0.07, 0.07, 0.1),
    maxWidth: box.w - 4,
  });
}

/** Stamps every field value onto the original PDF and appends a signing certificate page. */
export async function buildSignedPdf(original: Uint8Array, payload: FinalizationPayload, documentId: string, originalSha256: string) {
  const pdf = await PDFDocument.load(original, { updateMetadata: false });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages = pdf.getPages();

  for (const field of payload.fields) {
    const page = pages[field.page - 1];
    if (!page) continue;
    const { width, height } = page.getSize();
    // Field coordinates are fractions of the page measured from the top-left; PDF space starts bottom-left.
    const box = { x: field.x * width, y: height - (field.y + field.h) * height, w: field.w * width, h: field.h * height };

    if (field.type === "signature" || field.type === "initials") {
      const base64 = field.value.slice(field.value.indexOf(",") + 1);
      const image = await pdf.embedPng(Buffer.from(base64, "base64"));
      const scale = Math.min(box.w / image.width, box.h / image.height);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      page.drawImage(image, {
        x: box.x + (box.w - drawWidth) / 2,
        y: box.y + (box.h - drawHeight) / 2,
        width: drawWidth,
        height: drawHeight,
      });
    } else if (field.type === "checkbox") {
      if (field.value !== "true") continue;
      const inset = Math.min(box.w, box.h) * 0.2;
      const color = rgb(0.07, 0.07, 0.1);
      const thickness = Math.max(1, Math.min(box.w, box.h) * 0.1);
      page.drawLine({ start: { x: box.x + inset, y: box.y + box.h * 0.5 }, end: { x: box.x + box.w * 0.42, y: box.y + inset }, thickness, color });
      page.drawLine({ start: { x: box.x + box.w * 0.42, y: box.y + inset }, end: { x: box.x + box.w - inset, y: box.y + box.h - inset }, thickness, color });
    } else {
      drawFittedText(page, font, field.value, box);
    }
  }

  const certificate = pdf.addPage([612, 792]);
  let y = 730;
  const line = (text: string, options: { size?: number; font?: PDFFont; gap?: number; color?: [number, number, number] } = {}) => {
    const size = options.size ?? 10;
    const color = options.color ?? [0.2, 0.2, 0.24];
    certificate.drawText(encodable(options.font ?? font, text), {
      x: 56,
      y,
      size,
      font: options.font ?? font,
      color: rgb(...color),
      maxWidth: 500,
    });
    y -= options.gap ?? size + 8;
  };
  line("Signing certificate", { size: 20, font: bold, gap: 30, color: [0.07, 0.07, 0.1] });
  line(`Document: ${payload.title}`, { size: 11, font: bold });
  line(`Document ID: ${documentId}`);
  line(`Original PDF SHA-256: ${originalSha256}`, { size: 8, gap: 26 });
  line("Signers", { size: 13, font: bold, gap: 22, color: [0.07, 0.07, 0.1] });
  for (const signer of payload.signers) {
    line(`${signer.name} <${signer.email}>`, { size: 11, font: bold, gap: 15 });
    line(`Signed electronically: ${formatTimestamp(signer.signedAt)}`, { gap: 20 });
  }
  y -= 8;
  line(`Completed: ${formatTimestamp(new Date().toISOString())}`);
  line("Each signer agreed to sign electronically. Views, signatures, IP addresses, and user agents", { size: 8, gap: 11 });
  line("are recorded in the document audit log. The SHA-256 of this final file is stored with the document.", { size: 8 });

  pdf.setTitle(payload.title);
  pdf.setProducer("Duque Sign");
  return pdf.save();
}

/**
 * Generates, stores, and records the final signed PDF once every recipient has signed.
 * Safe to retry: the database refuses to finalize twice, and the upload overwrites a partial attempt.
 */
export async function finalizeDocument(documentId: string): Promise<{ sha256: string }> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("finalization_payload", { p_document_id: documentId });
  if (error) throw error;
  const payload = data as unknown as FinalizationPayload;
  if (!payload.originalPdfPath) throw new Error("The original PDF is missing.");

  const { data: originalBlob, error: downloadError } = await admin.storage.from(ORIGINAL_PDF_BUCKET).download(payload.originalPdfPath);
  if (downloadError) throw downloadError;
  const original = new Uint8Array(await originalBlob.arrayBuffer());
  const originalSha256 = createHash("sha256").update(original).digest("hex");

  const signed = await buildSignedPdf(original, payload, documentId, originalSha256);
  const sha256 = createHash("sha256").update(signed).digest("hex");
  const path = signedPdfPath(payload.organizationId, documentId, payload.version);

  const { error: uploadError } = await admin.storage
    .from(SIGNED_PDF_BUCKET)
    .upload(path, signed, { contentType: "application/pdf", upsert: true });
  if (uploadError) throw uploadError;

  const { error: finalizeError } = await admin.rpc("finalize_document", {
    p_document_id: documentId,
    p_final_pdf_path: path,
    p_sha256: sha256,
  });
  if (finalizeError) throw finalizeError;
  return { sha256 };
}
