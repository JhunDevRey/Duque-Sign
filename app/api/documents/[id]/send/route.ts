import { SIGNING_LINK_TTL_DAYS } from "@/lib/config/app";
import type { SigningLink } from "@/lib/domain/types";
import { createSigningToken, signingUrl } from "@/lib/signing/tokens";
import { databaseErrorResponse, isOrganizationMember, isSameOrigin, isUuid, jsonError } from "@/lib/supabase/documents";
import { getSession, UnauthenticatedError } from "@/lib/supabase/session";

export const runtime = "nodejs";

/**
 * Sends a draft: issues one signing link per recipient and locks the document's fields.
 * Raw links are returned only in this response; the database keeps their hashes.
 * Email delivery is not connected yet, so every link is returned for the sender to share.
 */
export async function POST(request: Request, context: RouteContext<"/api/documents/[id]/send">) {
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
    const organizationId = typeof body === "object" && body !== null ? (body as Record<string, unknown>).organizationId : null;
    if (!isUuid(organizationId)) return jsonError("Organization ID is required.", 400);
    if (!(await isOrganizationMember(supabase, user.uid, organizationId))) return jsonError("Document not found.", 404);

    const { data: recipients, error: recipientsError } = await supabase
      .from("recipients")
      .select("id, name, email, delivery, signing_order")
      .eq("document_id", id)
      .eq("organization_id", organizationId)
      .order("signing_order");
    if (recipientsError) throw recipientsError;
    // An empty list is passed through: send_document reports a missing document or recipients.

    const tokens = new Map(recipients.map((recipient) => [recipient.id, createSigningToken()]));
    const { data: sent, error: sendError } = await supabase.rpc("send_document", {
      p_document_id: id,
      p_token_hashes: Object.fromEntries([...tokens].map(([recipientId, { hash }]) => [recipientId, hash])),
      p_expires_in_days: SIGNING_LINK_TTL_DAYS,
    });
    if (sendError) return databaseErrorResponse(sendError, "Unable to send the document");

    const origin = new URL(request.url).origin;
    const statuses = new Map(sent.map((row) => [row.recipient_id, row.status]));
    const links: SigningLink[] = recipients.map((recipient) => ({
      recipientId: recipient.id,
      name: recipient.name,
      email: recipient.email,
      delivery: recipient.delivery === "link" ? "link" : "email",
      status: statuses.get(recipient.id) ?? "waiting",
      url: signingUrl(origin, tokens.get(recipient.id)!.token),
    }));
    return Response.json(
      { expiresAt: sent[0]?.expires_at ?? null, links },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) return jsonError(cause.message, 401);
    console.error("Document send failed", cause);
    return jsonError("Unable to send the document.", 503);
  }
}
