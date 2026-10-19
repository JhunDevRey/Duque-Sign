import { isSameOrigin, isUuid, jsonError } from "@/lib/supabase/documents";
import { getSession, UnauthenticatedError } from "@/lib/supabase/session";

export const runtime = "nodejs";

/** Revokes a key immediately. Requests already using it fail from now on. */
export async function DELETE(request: Request, context: RouteContext<"/api/api-keys/[id]">) {
  try {
    if (!isSameOrigin(request)) return jsonError("Invalid request origin.", 403);
    const { supabase } = await getSession();
    const { id } = await context.params;
    if (!isUuid(id)) return jsonError("API key not found.", 404);
    const { error } = await supabase.rpc("revoke_api_key", { p_api_key_id: id });
    if (error) {
      if (error.code === "P0002" || error.code === "42501") return jsonError("API key not found.", 404);
      console.error("API key revoke failed", error);
      return jsonError("Unable to revoke the API key.", 503);
    }
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) return jsonError(cause.message, 401);
    console.error("API key revoke failed", cause);
    return jsonError("Unable to revoke the API key.", 503);
  }
}
