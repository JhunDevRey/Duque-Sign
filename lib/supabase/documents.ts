import "server-only";

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { DocumentStatus, DocumentSummary, Field, FieldType, Recipient } from "@/lib/domain/types";

export const ORIGINAL_PDF_BUCKET = "original-pdfs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
type RecipientRow = Database["public"]["Tables"]["recipients"]["Row"];
type FieldRow = Database["public"]["Tables"]["fields"]["Row"];

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

/** Storage path for a document's original PDF. The first folder must be the organization ID (see storage RLS). */
export function originalPdfPath(organizationId: string, documentId: string, version: number): string {
  return `${organizationId}/${documentId}/v${version}/original.pdf`;
}

export async function isOrganizationMember(
  supabase: SupabaseClient<Database>,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

/** Maps the SQLSTATEs raised by the 002 migration's functions (and RLS denials) to API responses. */
export function databaseErrorResponse(error: PostgrestError, fallback: string) {
  switch (error.code) {
    case "P0002":
    case "42501":
      return jsonError("Document not found.", 404);
    case "55000":
      return jsonError(capitalize(error.message), 409);
    case "22023":
      return jsonError(capitalize(error.message), 400);
    case "23503":
      return jsonError("A field references a recipient outside this document.", 400);
    default:
      console.error(fallback, error);
      return jsonError(`${fallback}.`, 503);
  }
}

function capitalize(message: string): string {
  return message ? `${message[0].toLocaleUpperCase()}${message.slice(1)}.` : message;
}

// The UI has no separate "sent" state yet; both mean the document is out for signature.
function toDocumentStatus(status: DocumentRow["status"]): DocumentStatus {
  return status === "sent" ? "in_progress" : status;
}

export function toRecipient(row: RecipientRow): Recipient {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    order: row.signing_order,
    delivery: row.delivery === "link" ? "link" : "email",
    status: row.status,
    signedAt: row.signed_at ?? undefined,
  };
}

export function toField(row: FieldRow): Field {
  return {
    id: row.id,
    type: row.type as FieldType,
    recipientId: row.recipient_id,
    page: row.page,
    x: row.x,
    y: row.y,
    w: row.w,
    h: row.h,
    required: row.required,
    label: row.label ?? undefined,
    source: row.source === "anchor" ? "anchor" : "manual",
  };
}

export function toDocumentSummary(
  row: DocumentRow,
  recipients: RecipientRow[],
  fields: FieldRow[],
  createdByLabel: string,
): DocumentSummary {
  return {
    id: row.id,
    title: row.title,
    status: toDocumentStatus(row.status),
    externalId: row.external_id ?? undefined,
    originalFileName: row.original_file_name ?? undefined,
    version: row.version,
    pageCount: row.page_count,
    createdBy: createdByLabel,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sentAt: row.sent_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    finalSha256: row.final_pdf_sha256 ?? undefined,
    recipients: recipients.map(toRecipient),
    fields: fields.map(toField),
  };
}
