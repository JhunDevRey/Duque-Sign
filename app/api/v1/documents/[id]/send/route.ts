import { loadApiDocument, toApiDocument } from "@/lib/api/documents";
import { ApiError, apiJson, databaseError, handleApiRequest } from "@/lib/api/http";
import { SIGNING_LINK_TTL_DAYS } from "@/lib/config/app";
import { createSigningToken, signingUrl } from "@/lib/signing/tokens";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/supabase/documents";

export const runtime = "nodejs";

/**
 * Sends a draft and returns one signing URL per recipient, for the caller to email (delivery "link").
 * The URLs appear only in this response; the database keeps their hashes. Sending twice is refused
 * (409), so a retried request cannot issue a second set of links.
 * Optional JSON body: { "expires_in_days": 1–90 } (default 30).
 */
export async function POST(request: Request, routeContext: RouteContext<"/api/v1/documents/[id]/send">) {
  return handleApiRequest(request, async (context) => {
    const { id } = await routeContext.params;
    if (!isUuid(id)) throw new ApiError(404, "not_found", "Document not found.");

    let expiresInDays = SIGNING_LINK_TTL_DAYS;
    const text = await request.text();
    if (text.trim()) {
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        throw new ApiError(400, "invalid_request", "The request body must be JSON.");
      }
      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        throw new ApiError(400, "invalid_request", "The request body must be a JSON object.");
      }
      const value = (body as Record<string, unknown>).expires_in_days;
      if (value !== undefined) {
        if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 90) {
          throw new ApiError(400, "invalid_request", "`expires_in_days` must be a whole number from 1 to 90.");
        }
        expiresInDays = value;
      }
    }

    const { recipients } = await loadApiDocument(context, id);
    const tokens = new Map(recipients.map((recipient) => [recipient.id, createSigningToken()]));
    const { error: sendError } = await createSupabaseAdminClient().rpc("api_send_document", {
      p_api_key_id: context.apiKeyId,
      p_document_id: id,
      p_token_hashes: Object.fromEntries([...tokens].map(([recipientId, { hash }]) => [recipientId, hash])),
      p_expires_in_days: expiresInDays,
    });
    if (sendError) throw databaseError(sendError, "Unable to send the document");

    const sent = await loadApiDocument(context, id);
    const origin = new URL(request.url).origin;
    return apiJson(context.requestId, {
      document: toApiDocument(sent.document, sent.recipients, sent.fieldCount),
      signing_links: sent.recipients.map((recipient) => ({
        recipient_id: recipient.id,
        name: recipient.name,
        email: recipient.email,
        role: recipient.role,
        signing_order: recipient.signing_order,
        // Later signers can open their link now, but can only sign after the earlier ones.
        can_sign_now: recipient.status === "sent",
        url: signingUrl(origin, tokens.get(recipient.id)!.token),
      })),
    });
  });
}
