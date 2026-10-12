import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
} from "@/lib/firebase/session";

export const runtime = "nodejs";

function verifySameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  let idToken: unknown;
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || !("idToken" in body)) {
      return NextResponse.json({ error: "A Firebase ID token is required." }, { status: 400 });
    }
    idToken = body.idToken;
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }
  if (typeof idToken !== "string" || idToken.length < 100 || idToken.length > 10000) {
    return NextResponse.json({ error: "A valid Firebase ID token is required." }, { status: 400 });
  }

  let auth;
  try {
    ({ auth } = getFirebaseAdmin());
  } catch (cause) {
    console.error("Firebase Admin initialization failed", cause);
    return NextResponse.json({ error: "Unable to create a session. Check Firebase server configuration." }, { status: 503 });
  }
  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken, true);
  } catch {
    return NextResponse.json({ error: "The Firebase ID token is invalid or expired." }, { status: 401 });
  }
  if (decoded.email_verified !== true) {
    return NextResponse.json({ error: "Verify your email address before signing in." }, { status: 403 });
  }
  try {
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_DURATION_MS });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_MS / 1000,
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (cause) {
    console.error("Firebase session creation failed", cause);
    return NextResponse.json({ error: "Unable to create a session. Check Firebase server configuration." }, { status: 503 });
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    const { auth } = getFirebaseAdmin();
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    const response = NextResponse.json({
      uid: decoded.uid,
      email: decoded.email ?? null,
      name: decoded.name ?? null,
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith("Firebase Admin is not configured")) {
      return NextResponse.json({ error: cause.message }, { status: 503 });
    }
    if (
      typeof cause === "object" &&
      cause !== null &&
      "code" in cause &&
      typeof cause.code === "string" &&
      cause.code.startsWith("auth/")
    ) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }
    console.error("Firebase session verification failed", cause);
    return NextResponse.json({ error: "Unable to verify session." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
