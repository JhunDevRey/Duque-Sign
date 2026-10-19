import "server-only";

import { PDFDocument } from "pdf-lib";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_PAGES } from "@/lib/config/app";

export type PdfInspection =
  | { ok: true; bytes: Buffer; pageCount: number; fileName: string }
  | { ok: false; status: 400 | 413 | 415 | 422; message: string };

/** Validates an uploaded PDF (type, size, signature, encryption/malformation, page count). */
export async function inspectUploadedPdf(file: FormDataEntryValue | null): Promise<PdfInspection> {
  if (!(file instanceof File)) return { ok: false, status: 400, message: "Upload a PDF file." };
  if (file.size < 1 || file.size > MAX_UPLOAD_BYTES) return { ok: false, status: 413, message: "PDF file size exceeds the allowed limit." };
  if (file.type !== "application/pdf" && !file.name.toLocaleLowerCase().endsWith(".pdf")) {
    return { ok: false, status: 415, message: "Only PDF documents are accepted." };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") return { ok: false, status: 415, message: "The uploaded file is not a valid PDF." };
  let pageCount: number;
  try {
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
    pageCount = pdf.getPageCount();
  } catch {
    return { ok: false, status: 422, message: "The PDF is malformed or encrypted and cannot be processed." };
  }
  if (pageCount < 1 || pageCount > MAX_UPLOAD_PAGES) {
    return { ok: false, status: 422, message: `PDF must contain between 1 and ${MAX_UPLOAD_PAGES} pages.` };
  }
  const fileName = file.name.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 255) || "document.pdf";
  return { ok: true, bytes, pageCount, fileName };
}
