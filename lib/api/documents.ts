import "server-only";

import { ApiError, type ApiContext } from "@/lib/api/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/database.types";

type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
type RecipientRow = Database["public"]["Tables"]["recipients"]["Row"];

export type ApiRecipient = {
  id: string;
  name: string;
  email: string;
  role: string;
  signing_order: number;
  status: RecipientRow["status"];
  viewed_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
};

export type ApiDocument = {
  object: "document";
  id: string;
  title: string;
  status: DocumentRow["status"];
  external_id: string | null;
  metadata: Json;
  page_count: number;
  field_count: number;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  expires_at: string | null;
  completed_at: string | null;
  final_pdf_sha256: string | null;
  recipients: ApiRecipient[];
};

export function toApiRecipient(row: RecipientRow): ApiRecipient {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    signing_order: row.signing_order,
    status: row.status,
    viewed_at: row.viewed_at,
    signed_at: row.signed_at,
    declined_at: row.declined_at,
  };
}

export function toApiDocument(row: DocumentRow, recipients: RecipientRow[], fieldCount: number): ApiDocument {
  return {
    object: "document",
    id: row.id,
    title: row.title,
    status: row.status,
    external_id: row.external_id,
    metadata: row.metadata,
    page_count: row.page_count,
    field_count: fieldCount,
    created_at: row.created_at,
    updated_at: row.updated_at,
    sent_at: row.sent_at,
    expires_at: row.expires_at,
    completed_at: row.completed_at,
    final_pdf_sha256: row.final_pdf_sha256,
    recipients: recipients.map(toApiRecipient),
  };
}

/**
 * Loads a document owned by the API key's organization. The service-role client bypasses RLS,
 * so every query here filters on the organization explicitly.
 */
export async function loadApiDocument(context: ApiContext, documentId: string) {
  const admin = createSupabaseAdminClient();
  const { data: document, error } = await admin
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("organization_id", context.organizationId)
    .maybeSingle();
  if (error) throw error;
  if (!document) throw new ApiError(404, "not_found", "Document not found.");

  const [recipientsResult, fieldsResult] = await Promise.all([
    admin
      .from("recipients")
      .select("*")
      .eq("document_id", documentId)
      .eq("organization_id", context.organizationId)
      .order("signing_order")
      .order("created_at"),
    admin
      .from("fields")
      .select("id", { count: "exact", head: true })
      .eq("document_id", documentId)
      .eq("organization_id", context.organizationId),
  ]);
  if (recipientsResult.error) throw recipientsResult.error;
  if (fieldsResult.error) throw fieldsResult.error;
  return { document, recipients: recipientsResult.data, fieldCount: fieldsResult.count ?? 0 };
}
