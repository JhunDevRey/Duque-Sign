import "server-only";

import type { Json } from "@/lib/supabase/database.types";
import { ApiError, apiJson, databaseError, type ApiContext } from "@/lib/api/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ApiResult = { status: number; body: Json };

/**
 * Runs a create request at most once per `Idempotency-Key` header (kept 24 hours).
 * A retry with the same key and request replays the stored response; the same key with a different
 * request is rejected. Client errors (4xx) are stored like successes, while server errors release
 * the key so the request can be retried. Only use this for responses without secrets.
 */
export async function runIdempotent(
  request: Request,
  context: ApiContext,
  requestHash: string,
  run: () => Promise<ApiResult>,
): Promise<Response> {
  const key = request.headers.get("idempotency-key")?.trim();
  if (!key) {
    const result = await run();
    return apiJson(context.requestId, result.body, result.status);
  }
  if (key.length > 255) throw new ApiError(400, "invalid_request", "Idempotency-Key must be at most 255 characters.");

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("api_claim_idempotency", {
    p_api_key_id: context.apiKeyId,
    p_idempotency_key: key,
    p_request_hash: requestHash,
  });
  if (error) throw databaseError(error, "Unable to check the Idempotency-Key");
  const claim = data[0];
  if (!claim) throw new ApiError(503, "unavailable", "Unable to check the Idempotency-Key. Try again shortly.");

  switch (claim.state) {
    case "replay": {
      const response = apiJson(context.requestId, claim.response_body, claim.response_status ?? 200);
      response.headers.set("Idempotent-Replayed", "true");
      return response;
    }
    case "mismatch":
      throw new ApiError(422, "idempotency_key_reused", "This Idempotency-Key was already used for a different request.");
    case "in_progress":
      throw new ApiError(409, "request_in_progress", "A request with this Idempotency-Key is still being processed. Retry shortly.");
  }

  let result: ApiResult;
  try {
    result = await run();
  } catch (cause) {
    if (cause instanceof ApiError && cause.status < 500) {
      result = { status: cause.status, body: { error: { code: cause.code, message: cause.message }, request_id: context.requestId } };
    } else {
      await admin.rpc("api_release_idempotency", { p_api_key_id: context.apiKeyId, p_idempotency_key: key });
      throw cause;
    }
  }

  const { error: completeError } = await admin.rpc("api_complete_idempotency", {
    p_api_key_id: context.apiKeyId,
    p_idempotency_key: key,
    p_response_status: result.status,
    p_response_body: result.body,
  });
  // The work is done; failing to store the replay only matters if the client retries.
  if (completeError) console.error(`Unable to store idempotent response for request ${context.requestId}`, completeError);
  return apiJson(context.requestId, result.body, result.status);
}
