import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { getSessionUser, UnauthenticatedError } from "@/lib/firebase/session";
import { requireOrganizationMember } from "@/lib/firebase/tenant";

export const runtime = "nodejs";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, context: RouteContext<"/api/documents/[id]">) {
  try {
    const origin = request.headers.get("origin");
    if (!origin) return jsonError("Invalid request origin.", 403);
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) return jsonError("Invalid request origin.", 403);
    } catch {
      return jsonError("Invalid request origin.", 403);
    }
    const user = await getSessionUser();
    const { id } = await context.params;
    const body: unknown = await request.json();
    const record = typeof body === "object" && body !== null ? body as Record<string, unknown> : null;
    const organizationId = record?.organizationId;
    const action = record?.action;
    if (typeof organizationId !== "string" || !organizationId || organizationId.length > 128) {
      return jsonError("Organization ID is required.", 400);
    }
    if (action !== "cancel") return jsonError("Unsupported document action.", 400);
    if (!(await requireOrganizationMember(user, organizationId))) return jsonError("Document not found.", 404);

    const { firestore, fieldValue } = getFirebaseAdmin();
    const documentRef = firestore.collection("organizations").doc(organizationId).collection("documents").doc(id);
    await firestore.runTransaction(async (transaction) => {
      const document = await transaction.get(documentRef);
      if (!document.exists) throw new Error("NOT_FOUND");
      const status = document.get("status");
      if (status !== "draft" && status !== "in_progress") throw new Error("INVALID_TRANSITION");
      transaction.update(documentRef, { status: "cancelled", updatedAt: fieldValue.serverTimestamp() });
      transaction.create(documentRef.collection("auditEvents").doc(), {
        actorType: "user",
        actorId: user.uid,
        actorLabel: user.email ?? user.uid,
        action: "document.cancelled",
        createdAt: fieldValue.serverTimestamp(),
      });
    });
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) return jsonError(cause.message, 401);
    if (cause instanceof Error && cause.message === "NOT_FOUND") return jsonError("Document not found.", 404);
    if (cause instanceof Error && cause.message === "INVALID_TRANSITION") return jsonError("This document cannot be cancelled from its current state.", 409);
    console.error("Document update failed", cause);
    return jsonError("Unable to update the document.", 503);
  }
}
