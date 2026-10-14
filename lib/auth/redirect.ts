/** Only allow same-site relative paths as post-auth redirects. */
export function safeNextPath(value: string | null, fallback = "/dashboard"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}

/** Where to send someone whose email link failed, so they can request a new one. */
export function authLinkErrorPath(next: string): string {
  return next === "/reset-password" ? "/forgot-password?error=link_invalid" : "/login?auth_error=confirmation";
}
