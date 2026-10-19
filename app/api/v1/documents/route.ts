import { createHash } from "node:crypto";
import { loadApiDocument, toApiDocument } from "@/lib/api/documents";
import { ApiError, databaseError, handleApiRequest } from "@/lib/api/http";
import { runIdempotent } from "@/lib/api/idempotency";
import { FIELD_TYPES, type FieldType } from "@/lib/domain/types";
import { findAnchorsInPdf } from "@/lib/pdf/anchors-server";
import { constrain, MAX_FIELDS } from "@/lib/pdf/anchors";
import { inspectUploadedPdf } from "@/lib/pdf/validate";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { ORIGINAL_PDF_BUCKET, originalPdfPath } from "@/lib/supabase/documents";

export const runtime = "nodejs";

type RecipientInput = { name: string; email: string; role: string };
type FieldInput = {
  type: FieldType;
  role: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  required: boolean;
  label: string | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function invalid(message: string): never {
  throw new ApiError(400, "invalid_request", message);
}

function optionalText(form: FormData, name: string): string | null {
  const value = form.get(name);
  if (value === null) return null;
  if (typeof value !== "string") invalid(`\`${name}\` must be text.`);
  return value.trim() || null;
}

function parseJson(form: FormData, name: string): unknown {
  const value = optionalText(form, name);
  if (value === null) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    invalid(`\`${name}\` must be valid JSON.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Recipients come either as a `recipients` JSON array of {name, email, role} in signing order,
 * or — simpler to map in Make — as `recipient_name`, `recipient_email` and `recipient_role` for one signer.
 */
function parseRecipients(form: FormData): RecipientInput[] {
  const json = parseJson(form, "recipients");
  let raw: unknown[];
  if (json !== undefined) {
    if (!Array.isArray(json)) invalid("`recipients` must be a JSON array.");
    raw = json;
  } else {
    raw = [{
      name: optionalText(form, "recipient_name"),
      email: optionalText(form, "recipient_email"),
      role: optionalText(form, "recipient_role") ?? "Client",
    }];
  }
  if (raw.length < 1 || raw.length > 20) invalid("Provide 1 to 20 recipients.");

  const recipients = raw.map((item, index): RecipientInput => {
    const where = raw.length > 1 ? ` (recipient ${index + 1})` : "";
    if (!isRecord(item)) invalid(`Each recipient must be an object${where}.`);
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const email = typeof item.email === "string" ? item.email.trim().toLocaleLowerCase() : "";
    const role = typeof item.role === "string" && item.role.trim() ? item.role.trim() : "Client";
    if (!name || name.length > 120) invalid(`Recipient name must be 1–120 characters${where}.`);
    if (email.length > 254 || !EMAIL_PATTERN.test(email)) invalid(`Recipient email is not a valid address${where}.`);
    if (role.length > 80) invalid(`Recipient role must be at most 80 characters${where}.`);
    return { name, email, role };
  });
  if (new Set(recipients.map((recipient) => recipient.email)).size !== recipients.length) {
    invalid("Each recipient must have a different email address.");
  }
  // Anchor tags and `fields` refer to recipients by role, so roles must be unique.
  if (new Set(recipients.map((recipient) => recipient.role.toLocaleLowerCase())).size !== recipients.length) {
    invalid("Each recipient must have a different role, e.g. \"Client\" and \"Spouse\".");
  }
  return recipients;
}

function parseMetadata(form: FormData): Json {
  const json = parseJson(form, "metadata");
  if (json === undefined) return {};
  if (!isRecord(json)) invalid("`metadata` must be a JSON object.");
  if (Buffer.byteLength(JSON.stringify(json)) > 8192) invalid("`metadata` must be at most 8 KB.");
  return json as Json;
}

/** Optional coordinate fields: [{type, role, page, x, y, w, h, required?, label?}], fractions of the page. */
function parseFields(form: FormData): FieldInput[] {
  const json = parseJson(form, "fields");
  if (json === undefined) return [];
  if (!Array.isArray(json)) invalid("`fields` must be a JSON array.");
  return json.map((item, index): FieldInput => {
    const where = ` (field ${index + 1})`;
    if (!isRecord(item)) invalid(`Each field must be an object${where}.`);
    const { type, role, page, x, y, w, h, required, label } = item;
    if (typeof type !== "string" || !FIELD_TYPES.includes(type as FieldType)) {
      invalid(`Field type must be one of ${FIELD_TYPES.join(", ")}${where}.`);
    }
    if (typeof role !== "string" || !role.trim()) invalid(`Field role is required${where}.`);
    if (typeof page !== "number" || !Number.isInteger(page) || page < 1) invalid(`Field page must be a page number${where}.`);
    for (const [name, value] of Object.entries({ x, y, w, h })) {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
        invalid(`Field ${name} must be a fraction of the page between 0 and 1${where}.`);
      }
    }
    if ((w as number) <= 0 || (h as number) <= 0 || (x as number) + (w as number) > 1 || (y as number) + (h as number) > 1) {
      invalid(`Field must fit on the page${where}.`);
    }
    if (required !== undefined && typeof required !== "boolean") invalid(`Field required must be true or false${where}.`);
    if (label !== undefined && label !== null && (typeof label !== "string" || label.length > 160)) {
      invalid(`Field label must be text of at most 160 characters${where}.`);
    }
    return {
      type: type as FieldType,
      role: role.trim(),
      page,
      x: x as number,
      y: y as number,
      w: w as number,
      h: h as number,
      required: required ?? true,
      label: typeof label === "string" ? label : null,
    };
  });
}

function parseDetectAnchors(form: FormData): boolean {
  const value = optionalText(form, "detect_anchors");
  if (value === null) return true;
  if (/^(true|1|yes)$/i.test(value)) return true;
  if (/^(false|0|no)$/i.test(value)) return false;
  invalid("`detect_anchors` must be true or false.");
}

/**
 * Creates a draft from an uploaded PDF (multipart/form-data).
 * Fields are placed from anchor tags such as {{s:Client}} and/or from `fields`.
 * Send it with POST /api/v1/documents/{id}/send.
 */
export async function POST(request: Request) {
  return handleApiRequest(request, async (context) => {
    if (!request.headers.get("content-type")?.toLocaleLowerCase().startsWith("multipart/form-data")) {
      throw new ApiError(415, "unsupported_media_type", "Send the document as multipart/form-data with the PDF in a `file` part.");
    }
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new ApiError(400, "invalid_request", "The multipart body could not be read.");
    }

    const pdf = await inspectUploadedPdf(form.get("file"));
    if (!pdf.ok) throw new ApiError(pdf.status, pdf.status === 400 ? "invalid_request" : "invalid_pdf", pdf.message);
    const title = optionalText(form, "title") ?? pdf.fileName.replace(/\.pdf$/i, "");
    if (title.length < 1 || title.length > 180) invalid("`title` must be 1–180 characters.");
    const externalId = optionalText(form, "external_id");
    if (externalId && externalId.length > 120) invalid("`external_id` must be at most 120 characters.");
    const metadata = parseMetadata(form);
    const recipients = parseRecipients(form);
    const explicitFields = parseFields(form);
    const detectAnchors = parseDetectAnchors(form);

    const requestHash = createHash("sha256")
      .update(JSON.stringify({
        title,
        externalId,
        metadata,
        recipients,
        explicitFields,
        detectAnchors,
        file: createHash("sha256").update(pdf.bytes).digest("hex"),
      }))
      .digest("hex");

    return runIdempotent(request, context, requestHash, async () => {
      const recipientIds = recipients.map(() => crypto.randomUUID());
      const recipientIdByRole = new Map(recipients.map((recipient, index) => [recipient.role.toLocaleLowerCase(), recipientIds[index]]));

      const unknownRoles = new Set<string>();
      const fields: Array<Record<string, Json>> = [];
      for (const field of explicitFields) {
        if (field.page > pdf.pageCount) invalid(`A field is on page ${field.page}, but the PDF has ${pdf.pageCount} pages.`);
        const recipientId = recipientIdByRole.get(field.role.toLocaleLowerCase());
        if (!recipientId) invalid(`A field uses the role "${field.role}", which no recipient has.`);
        fields.push({ id: crypto.randomUUID(), recipientId, ...field, source: "manual" });
      }

      let anchorsFound = 0;
      if (detectAnchors) {
        let anchors;
        try {
          anchors = await findAnchorsInPdf(pdf.bytes);
        } catch (cause) {
          console.error(`Anchor detection failed for request ${context.requestId}`, cause);
          throw new ApiError(422, "invalid_pdf", "The PDF text could not be read to find anchor tags. Send `fields` instead, or set detect_anchors=false.");
        }
        for (const anchor of anchors) {
          const recipientId = recipientIdByRole.get(anchor.role.toLocaleLowerCase());
          if (!recipientId) {
            unknownRoles.add(anchor.role);
            continue;
          }
          anchorsFound += 1;
          fields.push({
            id: crypto.randomUUID(),
            recipientId,
            type: anchor.type,
            page: anchor.page,
            x: constrain(anchor.x, 0, 1 - anchor.w),
            y: constrain(anchor.y, 0, 1 - anchor.h),
            w: anchor.w,
            h: anchor.h,
            required: true,
            label: anchor.label,
            source: "anchor",
          });
        }
      }
      if (fields.length > MAX_FIELDS) invalid(`A document can have at most ${MAX_FIELDS} fields; this one has ${fields.length}.`);

      const documentId = crypto.randomUUID();
      const storagePath = originalPdfPath(context.organizationId, documentId, 1);
      const admin = createSupabaseAdminClient();
      const { error: uploadError } = await admin.storage
        .from(ORIGINAL_PDF_BUCKET)
        .upload(storagePath, pdf.bytes, { contentType: "application/pdf", upsert: false });
      if (uploadError) {
        console.error(`PDF upload failed for request ${context.requestId}`, uploadError);
        throw new ApiError(503, "unavailable", "Unable to store the PDF. Try again shortly.");
      }

      const { error: createError } = await admin.rpc("api_create_document", {
        p_api_key_id: context.apiKeyId,
        p_document_id: documentId,
        p_title: title,
        p_external_id: externalId,
        p_metadata: metadata,
        p_original_file_name: pdf.fileName,
        p_original_pdf_path: storagePath,
        p_page_count: pdf.pageCount,
        p_recipients: recipients.map((recipient, index) => ({ id: recipientIds[index], ...recipient })),
        p_fields: fields,
      });
      if (createError) {
        const { error: removeError } = await admin.storage.from(ORIGINAL_PDF_BUCKET).remove([storagePath]);
        if (removeError) console.error("Failed to remove orphaned uploaded PDF", storagePath, removeError);
        throw databaseError(createError, "Unable to save the document");
      }

      const { document, recipients: savedRecipients, fieldCount } = await loadApiDocument(context, documentId);
      const unsigned = recipients.filter((recipient, index) => !fields.some(
        (field) => field.recipientId === recipientIds[index] && field.type === "signature" && field.required === true,
      ));
      const warnings = [
        ...[...unknownRoles].map((role) => `The PDF has anchor tags for the role "${role}", but no recipient has that role.`),
        ...unsigned.map((recipient) => `${recipient.name} (${recipient.role}) has no signature field yet; sending will fail until one is added, e.g. with {{s:${recipient.role}}} in the PDF.`),
      ];
      return {
        status: 201,
        body: {
          document: toApiDocument(document, savedRecipients, fieldCount),
          anchors: { detected: detectAnchors, placed: anchorsFound, unmatched_roles: [...unknownRoles] },
          ready_to_send: unsigned.length === 0,
          warnings,
        },
      };
    });
  });
}
