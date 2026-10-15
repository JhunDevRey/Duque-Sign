import { createSigningToken, signingUrl } from "@/lib/signing/tokens";
import { databaseErrorResponse, isOrganizationMember, isSameOrigin, isUuid, jsonError } from "@/lib/supabase/documents";
import { getSession, UnauthenticatedError } from "@/lib/supabase/session";

export const runtime = "nodejs";

/** Issues a new signing link for one recipient. The previous link stops working immediately. */
export async function POST(
  request: Request,
  context: RouteContext<"/api/documents/[id]/recipients/[recipientId]/link">,
) {
  try {
    if (!isSameOrigin(request)) return jsonError("Invalid request origin.", 403);
    const { supabase, user } = await getSession();
    const { id, recipientId } = await context.params;
    if (!isUuid(id) || !isUuid(recipientId)) return jsonError("Document not found.", 404);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON request body.", 400);
    }
    const organizationId = typeof body === "object" && body !== null ? (body as Record<string, unknown>).organizationId : null;
    if (!isUuid(organizationId)) return jsonError("Organization ID is required.", 400);
    if (!(await isOrganizationMember(supabase, user.uid, organizationId))) return jsonError("Document not found.", 404);

    const { token, hash } = createSigningToken();
    const { error } = await supabase.rpc("reissue_signing_link", {
      p_document_id: id,
      p_recipient_id: recipientId,
      p_token_hash: hash,
    });
    if (error) return databaseErrorResponse(error, "Unable to issue a new signing link");
    return Response.json(
      { url: signingUrl(new URL(request.url).origin, token) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) return jsonError(cause.message, 401);
    console.error("Signing link reissue failed", cause);
    return jsonError("Unable to issue a new signing link.", 503);
  }
}
