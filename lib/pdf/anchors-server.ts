import "server-only";

import { findAnchors, type AnchorMatch } from "@/lib/pdf/anchors";

/** Scans a PDF's text layer for anchor tags on the server, with pdf.js's Node build. */
export async function findAnchorsInPdf(bytes: Uint8Array): Promise<AnchorMatch[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // pdf.js takes ownership of the buffer it is given, so pass a copy.
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  });
  const pdf = await task.promise;
  try {
    return await findAnchors(pdf);
  } finally {
    await task.destroy();
  }
}
