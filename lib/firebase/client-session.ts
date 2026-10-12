"use client";

export async function establishServerSession(idToken: string): Promise<void> {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
    signal: AbortSignal.timeout(20000),
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("The server returned an invalid response while creating your session.");
  }
  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
        ? body.error
        : "Unable to create a secure session.";
    throw new Error(message);
  }
}

export async function getPostLoginPath(): Promise<string> {
  const response = await fetch("/api/organizations", {
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("The server returned an invalid organization response.");
  }
  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
        ? body.error
        : "Unable to load your organization.";
    throw new Error(message);
  }
  if (
    typeof body === "object" &&
    body !== null &&
    "organizations" in body &&
    Array.isArray(body.organizations) &&
    body.organizations.length > 0
  ) {
    return "/dashboard";
  }
  return "/onboarding";
}

export function firebaseAuthMessage(cause: unknown): string {
  if (cause instanceof Error) {
    const code = "code" in cause && typeof cause.code === "string" ? cause.code : "";
    if (code === "EMAIL_EXISTS") return "An account already exists for that email.";
    if (["INVALID_LOGIN_CREDENTIALS", "INVALID_PASSWORD", "EMAIL_NOT_FOUND"].includes(code)) {
      return "The email or password is incorrect.";
    }
    if (code === "WEAK_PASSWORD") return "Choose a stronger password (at least 12 characters).";
    if (code === "TOO_MANY_ATTEMPTS_TRY_LATER") return "Too many attempts. Wait a while and try again.";
    if (code === "NETWORK_REQUEST_FAILED") return "Firebase could not be reached. Check your connection and configuration.";
    return cause.message;
  }
  return "The request could not be completed.";
}
