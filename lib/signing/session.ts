import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import type { FieldType, RecipientStatus } from "@/lib/domain/types";
import { hashSigningToken } from "@/lib/signing/tokens";
import { jsonError } from "@/lib/supabase/documents";

/** What the recipient may do with their link. Mirrors app_private.signing_state in 005. */
export type SigningState = "ready" | "waiting" | "signed" | "declined" | "completed" | "expired" | "closed";

export type SigningField = {
  id: string;
  type: FieldType;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  required: boolean;
  label: string | null;
};

/** The signing session as returned to the browser. Storage paths stay on the server. */
export type SigningSession = {
  state: SigningState;
  document: {
    id: string;
    title: string;
    pageCount: number;
    expiresAt: string | null;
    completedAt: string | null;
    finalSha256: string | null;
    hasFinalPdf: boolean;
  };
  recipient: { id: string; name: string; email: string; role: string; status: RecipientStatus; signedAt: string | null };
  fields: SigningField[];
  signers: Array<{ name: string; order: number; status: RecipientStatus; isYou: boolean }>;
};

/** The database response, including server-only storage paths. */
export type SigningSessionRecord = Omit<SigningSession, "document"> & {
  document: Omit<SigningSession["document"], "hasFinalPdf"> & {
    organizationId: string;
    originalPdfPath: string | null;
    finalPdfPath: string | null;
  };
};

// Tokens are 32 random bytes in base64url (see createSigningToken).
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Hashes a signing token from a URL, or returns null when it cannot be a valid token. */
export function tokenHashFromParam(token: string): string | null {
  return TOKEN_PATTERN.test(token) ? hashSigningToken(token) : null;
}

export function toClientSession(record: SigningSessionRecord): SigningSession {
  const { id, title, pageCount, expiresAt, completedAt, finalSha256, finalPdfPath } = record.document;
  return {
    state: record.state,
    recipient: record.recipient,
    fields: record.fields,
    signers: record.signers,
    document: { id, title, pageCount, expiresAt, completedAt, finalSha256, hasFinalPdf: Boolean(finalPdfPath) },
  };
}

/** Client details recorded as signing evidence in the audit log. */
export function clientEvidence(request: Request): { ip: string; userAgent: string } {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: forwarded || request.headers.get("x-real-ip") || "",
    userAgent: (request.headers.get("user-agent") ?? "").slice(0, 500),
  };
}

export const INVALID_LINK_MESSAGE = "This signing link is invalid or has been replaced. Ask the sender for a new link.";

/** Maps errors raised by the 005 signing functions to API responses. */
export function signingErrorResponse(error: PostgrestError, fallback: string) {
  switch (error.code) {
    case "P0002":
      return jsonError(INVALID_LINK_MESSAGE, 404);
    case "55000":
      return jsonError(capitalize(error.message), 409);
    case "22023":
      return jsonError(capitalize(error.message), 400);
    default:
      console.error(fallback, error);
      return jsonError(`${fallback}.`, 503);
  }
}

function capitalize(message: string): string {
  return message ? `${message[0].toLocaleUpperCase()}${message.slice(1)}.` : message;
}
