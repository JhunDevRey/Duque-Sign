import { finalizeDocument } from "@/lib/signing/finalize";
import {
  clientEvidence,
  INVALID_LINK_MESSAGE,
  signingErrorResponse,
  toClientSession,
  tokenHashFromParam,
  type SigningSessionRecord,
} from "@/lib/signing/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSameOrigin, jsonError } from "@/lib/supabase/documents";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

/** Opens a recipient's signing session. The first open of an actionable link is audited as a view. */
export async function GET(request: Request, context: RouteContext<"/api/sign/[token]">) {
  try {
    const tokenHash = tokenHashFromParam((await context.params).token);
    if (!tokenHash) return jsonError(INVALID_LINK_MESSAGE, 404);
    const { ip, userAgent } = clientEvidence(request);
    const { data, error } = await createSupabaseAdminClient().rpc("open_signing_session", {
      p_token_hash: tokenHash,
      p_ip: ip,
      p_user_agent: userAgent,
    });
    if (error) return signingErrorResponse(error, "Unable to open this document");
    return Response.json(toClientSession(data as unknown as SigningSessionRecord), { headers: noStore });
  } catch (cause) {
    console.error("Signing session failed", cause);
    return jsonError("Unable to open this document right now. Try again shortly.", 503);
  }
}

/**
 * Signs or declines. Body: {"action":"sign","consent":true,"values":{"<field id>":"<value>"}}
 * or {"action":"decline","reason":"..."}. The last signature triggers final PDF generation.
 */
export async function POST(request: Request, context: RouteContext<"/api/sign/[token]">) {
  try {
    if (!isSameOrigin(request)) return jsonError("Invalid request origin.", 403);
    const tokenHash = tokenHashFromParam((await context.params).token);
    if (!tokenHash) return jsonError(INVALID_LINK_MESSAGE, 404);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON request body.", 400);
    }
    if (typeof body !== "object" || body === null) return jsonError("Invalid request body.", 400);
    const input = body as Record<string, unknown>;
    const { ip, userAgent } = clientEvidence(request);
    const admin = createSupabaseAdminClient();

    if (input.action === "decline") {
      const reason = typeof input.reason === "string" ? input.reason : "";
      const { error } = await admin.rpc("decline_signing", {
        p_token_hash: tokenHash,
        p_reason: reason,
        p_ip: ip,
        p_user_agent: userAgent,
      });
      if (error) return signingErrorResponse(error, "Unable to decline this document");
      return Response.json({ declined: true }, { headers: noStore });
    }

    if (input.action !== "sign") return jsonError("Unknown action.", 400);
    if (typeof input.values !== "object" || input.values === null || Array.isArray(input.values)) {
      return jsonError("Field values are required.", 400);
    }
    const { data, error } = await admin.rpc("submit_signature", {
      p_token_hash: tokenHash,
      p_values: input.values as Record<string, string>,
      p_consent: input.consent === true,
      p_ip: ip,
      p_user_agent: userAgent,
    });
    if (error) return signingErrorResponse(error, "Unable to save your signature");

    const result = data as unknown as { documentId: string; allSigned: boolean };
    let completed = false;
    if (result.allSigned) {
      try {
        await finalizeDocument(result.documentId);
        completed = true;
      } catch (cause) {
        // The signature is saved. The sender can retry finalization from the document page.
        console.error("Final PDF generation failed", result.documentId, cause);
      }
    }
    return Response.json({ signed: true, completed }, { headers: noStore });
  } catch (cause) {
    console.error("Signing action failed", cause);
    return jsonError("Unable to complete this action right now. Try again shortly.", 503);
  }
}
