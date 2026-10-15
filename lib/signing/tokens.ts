import "server-only";

import { createHash, randomBytes } from "node:crypto";

/**
 * Signing links carry a 256-bit random token. Only its SHA-256 hex digest is stored
 * (recipients.signing_token_hash), so a database leak does not expose usable links.
 * A fast hash is appropriate here because the token is high-entropy, not a password.
 */
export function createSigningToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashSigningToken(token) };
}

export function hashSigningToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function signingUrl(origin: string, token: string): string {
  return new URL(`/sign/${token}`, origin).toString();
}
