import { NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { getSessionUser, UnauthenticatedError } from "@/lib/firebase/session";

export const runtime = "nodejs";

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function errorResponse(cause: unknown) {
  if (cause instanceof UnauthenticatedError) {
    return NextResponse.json({ error: cause.message }, { status: 401 });
  }
  console.error("Organization request failed", cause);
  return NextResponse.json({ error: "Unable to process the organization request." }, { status: 503 });
}

export async function GET() {
  try {
    const user = await getSessionUser();
    const { firestore } = getFirebaseAdmin();
    const memberships = await firestore.collection("users").doc(user.uid).collection("memberships").get();
    const organizations = await Promise.all(
      memberships.docs.map(async (membership) => {
        const organizationRef = firestore.collection("organizations").doc(membership.id);
        const [organization, activeMembership] = await Promise.all([
          organizationRef.get(),
          organizationRef.collection("members").doc(user.uid).get(),
        ]);
        if (!organization.exists || !activeMembership.exists) return null;
        return { id: organization.id, ...organization.data(), role: activeMembership.get("role") };
      }),
    );
    return NextResponse.json({ organizations: organizations.filter(Boolean) }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }
    const bodyRecord = typeof body === "object" && body !== null ? body as Record<string, unknown> : null;
    const organizationName = bodyRecord?.name;
    if (
      typeof organizationName !== "string" ||
      organizationName.trim().length < 2 ||
      organizationName.trim().length > 120
    ) {
      return NextResponse.json({ error: "Organization name must be 2–120 characters." }, { status: 400 });
    }
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const { firestore, fieldValue } = getFirebaseAdmin();
    const organizationRef = firestore.collection("organizations").doc();
    const memberRef = organizationRef.collection("members").doc(user.uid);
    const membershipRef = firestore.collection("users").doc(user.uid).collection("memberships").doc(organizationRef.id);
    await firestore.runTransaction(async (transaction) => {
      transaction.create(organizationRef, {
        name: organizationName.trim(),
        createdAt: fieldValue.serverTimestamp(),
        createdBy: user.uid,
      });
      transaction.create(memberRef, {
        uid: user.uid,
        email: user.email ?? null,
        name: user.name ?? null,
        role: "owner",
        joinedAt: fieldValue.serverTimestamp(),
      });
      transaction.create(membershipRef, {
        organizationId: organizationRef.id,
        role: "owner",
        joinedAt: fieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({ organization: { id: organizationRef.id, name: organizationName.trim(), role: "owner" } }, { status: 201 });
  } catch (cause) {
    return errorResponse(cause);
  }
}
