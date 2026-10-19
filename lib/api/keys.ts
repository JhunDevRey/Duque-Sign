import "server-only";

import { createHash, randomBytes } from "node:crypto";

/**
 * API keys look like sk_live_<43 base64url characters> (256 random bits). Only the SHA-256 hex
 * digest is stored; like signing tokens, a fast hash is appropriate because the key is
 * high-entropy, not a password. The first 12 characters are kept to help people tell keys apart.
 */
const KEY_PREFIX = "sk_live_";
const KEY_PATTERN = /^sk_live_[A-Za-z0-9_-]{43}$/;

export function createApiKey(): { key: string; prefix: string; hash: string } {
  const key = `${KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { key, prefix: key.slice(0, KEY_PREFIX.length + 4), hash: hashApiKey(key) };
}

export function isApiKeyFormat(value: string): boolean {
  return KEY_PATTERN.test(value);
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}
