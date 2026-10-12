import { cookies } from "next/headers";
import type { DecodedIdToken } from "firebase-admin/auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production" ? "__Host-duque_session" : "duque_session";
export const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;

export class UnauthenticatedError extends Error {
  constructor() {
    super("Sign in to continue.");
    this.name = "UnauthenticatedError";
  }
}

export async function getSessionUser(): Promise<DecodedIdToken> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) throw new UnauthenticatedError();
  const { auth } = getFirebaseAdmin();
  try {
    return await auth.verifySessionCookie(sessionCookie, true);
  } catch (cause) {
    if (
      typeof cause === "object" &&
      cause !== null &&
      "code" in cause &&
      typeof cause.code === "string" &&
      cause.code.startsWith("auth/")
    ) {
      throw new UnauthenticatedError();
    }
    throw cause;
  }
}
