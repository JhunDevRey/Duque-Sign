import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { hashApiKey, isApiKeyFormat } from "@/lib/api/keys";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Conventions for /api/v1:
 * - Authentication: `Authorization: Bearer sk_live_…`.
 * - Every response carries an `X-Request-Id` header; errors use
 *   `{ "error": { "code", "message" }, "request_id" }` so a caller can quote the ID when reporting a problem.
 * - JSON bodies use snake_case.
 */

export type ApiContext = {
  requestId: string;
  apiKeyId: string;
  organizationId: string;
  organizationName: string;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const baseHeaders = { "Cache-Control": "no-store" };

export function apiJson(requestId: string, body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { ...baseHeaders, "X-Request-Id": requestId } });
}

function errorResponse(requestId: string, error: ApiError): Response {
  return apiJson(requestId, { error: { code: error.code, message: error.message }, request_id: requestId }, error.status);
}

function capitalize(message: string): string {
  return message ? `${message[0].toLocaleUpperCase()}${message.slice(1)}.` : message;
}

/** Maps the SQLSTATEs raised by the database functions (see the migrations) to API errors. */
export function databaseError(error: PostgrestError, context: string): ApiError {
  switch (error.code) {
    case "42501":
      return new ApiError(401, "invalid_api_key", "The API key is invalid or has been revoked.");
    case "P0002":
      return new ApiError(404, "not_found", "Document not found.");
    case "55000":
      return new ApiError(409, "invalid_state", capitalize(error.message));
    case "22023":
    case "23514":
      return new ApiError(400, "invalid_request", capitalize(error.message));
    case "23503":
      return new ApiError(400, "invalid_request", "A field references a recipient outside this document.");
    case "23505":
      return new ApiError(409, "conflict", "A record with this ID already exists.");
    default:
      console.error(context, error);
      return new ApiError(503, "unavailable", `${context}. Try again shortly.`);
  }
}

async function authenticate(request: Request, requestId: string): Promise<ApiContext> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) throw new ApiError(401, "missing_api_key", "Send your API key as `Authorization: Bearer sk_live_…`.");
  if (!isApiKeyFormat(match[1])) throw new ApiError(401, "invalid_api_key", "The API key is invalid or has been revoked.");

  const { data, error } = await createSupabaseAdminClient().rpc("api_authenticate_key", { p_key_hash: hashApiKey(match[1]) });
  if (error) throw databaseError(error, "Unable to verify the API key");
  const key = data[0];
  if (!key) throw new ApiError(401, "invalid_api_key", "The API key is invalid or has been revoked.");
  return { requestId, apiKeyId: key.api_key_id, organizationId: key.organization_id, organizationName: key.organization_name };
}

/** Authenticates the request, runs the handler, and turns any failure into the standard error format. */
export async function handleApiRequest(
  request: Request,
  handler: (context: ApiContext) => Promise<Response>,
): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const context = await authenticate(request, requestId);
    const response = await handler(context);
    response.headers.set("X-Request-Id", requestId);
    return response;
  } catch (cause) {
    if (cause instanceof ApiError) return errorResponse(requestId, cause);
    console.error(`API request ${requestId} failed`, cause);
    return errorResponse(requestId, new ApiError(500, "internal_error", "Something went wrong. Quote the request ID if you contact support."));
  }
}
