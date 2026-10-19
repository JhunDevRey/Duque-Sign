import type { FieldType } from "@/lib/domain/types";

/**
 * Anchor tags place fields from text in the PDF, so contracts generated from DOCX templates need
 * no manual placement. Syntax: {{<type>:<Role>}}, where type is s (signature), i (initials),
 * d (date), c (checkbox) or t (text) and Role matches a recipient's role, e.g. {{s:Client}}.
 * Shared by the field editor (browser) and the API (server).
 */
export const ANCHOR_PATTERN = /\{\{\s*([sidct])\s*:\s*([^{}]+?)\s*\}\}/gi;

export const ANCHOR_TYPES: Record<string, FieldType> = {
  s: "signature",
  i: "initials",
  d: "date",
  c: "checkbox",
  t: "text",
};

/** Default field sizes as fractions of the page width and height. */
export const FIELD_SIZES: Record<FieldType, { w: number; h: number }> = {
  signature: { w: 0.24, h: 0.075 },
  initials: { w: 0.12, h: 0.055 },
  date: { w: 0.16, h: 0.05 },
  text: { w: 0.25, h: 0.06 },
  checkbox: { w: 0.045, h: 0.045 },
};

export const MAX_FIELDS = 100;

export type AnchorMatch = {
  type: FieldType;
  role: string;
  /** The tag as written, e.g. "{{s:Client}}". Also identifies the anchor on its page. */
  label: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

// The parts of a pdf.js document this module uses. Structural, so the browser build and the
// Node (legacy) build of pdf.js both fit.
type TextItem = { str: string; transform: number[]; width: number; height: number };
type PdfPage = {
  getViewport(options: { scale: number }): {
    width: number;
    height: number;
    scale: number;
    convertToViewportPoint(x: number, y: number): number[];
  };
  getTextContent(): Promise<{ items: object[] }>;
};
export type AnchorSource = { numPages: number; getPage(pageNumber: number): Promise<PdfPage> };

function isTextItem(item: object): item is TextItem {
  return "str" in item && typeof item.str === "string" && "transform" in item && Array.isArray(item.transform);
}

export function constrain(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Every anchor tag in the PDF's text layer, positioned where the tag is printed. */
export async function findAnchors(pdf: AnchorSource): Promise<AnchorMatch[]> {
  const matches: AnchorMatch[] = [];
  const pattern = new RegExp(ANCHOR_PATTERN.source, ANCHOR_PATTERN.flags);
  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    for (const item of textContent.items) {
      if (!isTextItem(item) || !item.str.includes("{{")) continue;
      const text = item.str;
      const itemWidth = item.width || 0;
      const itemHeight = item.height || 0;
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const type = ANCHOR_TYPES[match[1].toLocaleLowerCase()];
        const [baseX, baseY] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
        const textWidth = itemWidth * viewport.scale;
        const textHeight = itemHeight * viewport.scale;
        const top = Math.max(0, baseY - textHeight);
        const x = Math.max(0, baseX + textWidth * (match.index / Math.max(1, text.length)));
        const size = FIELD_SIZES[type];
        const w = Math.min(0.98, Math.max(size.w, (textWidth * (match[0].length / text.length)) / viewport.width + 0.01));
        const h = Math.min(0.98, Math.max(size.h, textHeight / viewport.height + 0.015));
        matches.push({
          type,
          role: match[2].trim(),
          label: match[0].trim(),
          page: pageIndex,
          x: constrain(x / viewport.width, 0, 1 - w),
          y: constrain(top / viewport.height, 0, 1 - h),
          w,
          h,
        });
      }
    }
  }
  return matches;
}
