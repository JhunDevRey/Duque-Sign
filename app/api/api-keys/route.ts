import { createApiKey } from "@/lib/api/keys";
import { databaseErrorResponse, isSameOrigin, isUuid, jsonError } from "@/lib/supabase/documents";
import { getSession, UnauthenticatedError } from "@/lib/supabase/session";

export const runtime = "nodejs";

const KEY_COLUMNS = "id, name, key_prefix, created_at, last_used_at, revoked_at";

type KeyRow = { id: string; name: string; key_prefix: string; created_at: string; last_used_at: string | null; revoked_at: string | null };

function toApiKey(row: KeyRow) {
  return {
    id: row.id,
    name: row.name,
    prefix: row.key_prefix,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  };
}

/** API keys for an organization. Owners and admins only (RLS returns nothing to members). */
export async function GET(request: Request) {
  try {
    const { supabase, user } = await getSession();
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!isUuid(organizationId)) return jsonError("Organization ID is required.", 400);
    const { data: membership, error: membershipError } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.uid)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) return jsonError("Organization not found.", 404);
    const canManage = membership.role === "owner" || membership.role === "admin";
    if (!canManage) return Response.json({ canManage, keys: [] }, { headers: { "Cache-Control": "no-store" } });

    const { data, error } = await supabase
      .from("api_keys")
      .select(KEY_COLUMNS)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return Response.json({ canManage, keys: (data as KeyRow[]).map(toApiKey) }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) return jsonError(cause.message, 401);
    console.error("API key list failed", cause);
    return jsonError("Unable to load API keys.", 503);
  }
}

/** Creates a key. The secret is returned once, in this response, and only its hash is stored. */
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return jsonError("Invalid request origin.", 403);
    const { supabase } = await getSession();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON request body.", 400);
    }
    const input = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    if (!isUuid(input.organizationId)) return jsonError("Organization ID is required.", 400);
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (name.length < 1 || name.length > 80) return jsonError("Key name must be 1–80 characters.", 400);

    const { key, prefix, hash } = createApiKey();
    const { data: id, error } = await supabase.rpc("create_api_key", {
      p_organization_id: input.organizationId,
      p_name: name,
      p_key_prefix: prefix,
      p_key_hash: hash,
    });
    if (error) {
      if (error.code === "42501") return jsonError("Only organization owners and admins can create API keys.", 403);
      return databaseErrorResponse(error, "Unable to create the API key");
    }
    const { data: row, error: rowError } = await supabase.from("api_keys").select(KEY_COLUMNS).eq("id", id).single();
    if (rowError) throw rowError;
    return Response.json({ key, apiKey: toApiKey(row as KeyRow) }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) return jsonError(cause.message, 401);
    console.error("API key creation failed", cause);
    return jsonError("Unable to create the API key.", 503);
  }
}
