import { databaseErrorResponse, isOrganizationMember, isSameOrigin, isUuid, jsonError } from "@/lib/supabase/documents";
import { getSession, UnauthenticatedError } from "@/lib/supabase/session";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: RouteContext<"/api/documents/[id]">) {
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
    const record = typeof body === "object" && body !== null ? body as Record<string, unknown> : null;
    const organizationId = record?.organizationId;
    if (!isUuid(organizationId)) return jsonError("Organization ID is required.", 400);
    if (record?.action !== "cancel") return jsonError("Unsupported document action.", 400);
    if (!(await isOrganizationMember(supabase, user.uid, organizationId))) return jsonError("Document not found.", 404);

    const { data: document, error: lookupError } = await supabase
      .from("documents")
      .select("id")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!document) return jsonError("Document not found.", 404);

    const { error } = await supabase.rpc("cancel_document", { p_document_id: id });
    if (error) return databaseErrorResponse(error, "Unable to update the document");
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) return jsonError(cause.message, 401);
    console.error("Document update failed", cause);
    return jsonError("Unable to update the document.", 503);
  }
}
