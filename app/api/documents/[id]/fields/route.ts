import type { Field, FieldType } from "@/lib/domain/types";
import { FIELD_TYPES } from "@/lib/domain/types";
import {
  databaseErrorResponse,
  isOrganizationMember,
  isSameOrigin,
  isUuid,
  jsonError,
  toField,
} from "@/lib/supabase/documents";
import { getSession, UnauthenticatedError } from "@/lib/supabase/session";

export const runtime = "nodejs";
const MAX_FIELDS = 100;

function validField(value: unknown): value is Field {
  if (typeof value !== "object" || value === null) return false;
  const field = value as Record<string, unknown>;
  return (
    isUuid(field.id) &&
    isUuid(field.recipientId) &&
    FIELD_TYPES.includes(field.type as FieldType) &&
    Number.isInteger(field.page) &&
    typeof field.page === "number" &&
    field.page >= 1 &&
    Number.isFinite(field.x) &&
    typeof field.x === "number" &&
    Number.isFinite(field.y) &&
    typeof field.y === "number" &&
    Number.isFinite(field.w) &&
    typeof field.w === "number" &&
    Number.isFinite(field.h) &&
    typeof field.h === "number" &&
    field.x >= 0 &&
    field.y >= 0 &&
    field.w > 0 &&
    field.h > 0 &&
    field.w <= 1 &&
    field.h <= 1 &&
    field.x + field.w <= 1.001 &&
    field.y + field.h <= 1.001 &&
    typeof field.required === "boolean" &&
    (field.source === "manual" || field.source === "anchor") &&
    (field.label === undefined || (typeof field.label === "string" && field.label.length <= 160))
  );
}

/** Resolves the document only if it belongs to an organization the caller is a member of. */
async function findDocument(
  supabase: Awaited<ReturnType<typeof getSession>>["supabase"],
  userId: string,
  organizationId: string,
  documentId: string,
): Promise<boolean> {
  if (!(await isOrganizationMember(supabase, userId, organizationId))) return false;
  const { data, error } = await supabase
    .from("documents")
    .select("id")
    .eq("id", documentId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function GET(
  request: Request,
  context: RouteContext<"/api/documents/[id]/fields">,
) {
  try {
    const { supabase, user } = await getSession();
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    const { id } = await context.params;
    if (!isUuid(organizationId)) return jsonError("Organization ID is required.", 400);
    if (!isUuid(id)) return jsonError("Document not found.", 404);
    if (!(await findDocument(supabase, user.uid, organizationId, id))) return jsonError("Document not found.", 404);

    const { data: fields, error } = await supabase.from("fields").select("*").eq("document_id", id);
    if (error) throw error;
    return Response.json({ fields: fields.map(toField) }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) return jsonError(cause.message, 401);
    console.error("Document field read failed", cause);
    return jsonError("Unable to load document fields.", 503);
  }
}

export async function PUT(
  request: Request,
  context: RouteContext<"/api/documents/[id]/fields">,
) {
  try {
    if (!isSameOrigin(request)) return jsonError("Invalid request origin.", 403);
    const { supabase, user } = await getSession();
    const { id } = await context.params;
    if (!isUuid(id)) return jsonError("Document not found.", 404);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON request body.", 400);
    }
    const bodyRecord = typeof body === "object" && body !== null ? body as Record<string, unknown> : null;
    const organizationId = bodyRecord?.organizationId;
    const fields = bodyRecord?.fields;
    if (!isUuid(organizationId)) return jsonError("Organization ID is required.", 400);
    if (!Array.isArray(fields) || fields.length > MAX_FIELDS || !fields.every(validField)) {
      return jsonError(`Fields must be valid and no more than ${MAX_FIELDS}.`, 400);
    }
    if (new Set(fields.map((field) => field.id)).size !== fields.length) {
      return jsonError("Field IDs must be unique.", 400);
    }
    if (!(await findDocument(supabase, user.uid, organizationId, id))) return jsonError("Document not found.", 404);

    const { data: fieldCount, error } = await supabase.rpc("replace_document_fields", {
      p_document_id: id,
      p_fields: fields,
    });
    if (error) return databaseErrorResponse(error, "Unable to save document fields");
    return Response.json({ ok: true, fieldCount }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) return jsonError(cause.message, 401);
    console.error("Document field update failed", cause);
    return jsonError("Unable to save document fields.", 503);
  }
}
