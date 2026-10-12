import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { getSessionUser, UnauthenticatedError } from "@/lib/firebase/session";
import { requireOrganizationMember } from "@/lib/firebase/tenant";

export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request, context: RouteContext<"/api/documents/[id]/file">) {
  try {
    const user = await getSessionUser();
    const { id } = await context.params;
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId || organizationId.length > 128) return errorResponse("Organization ID is required.", 400);
    if (!(await requireOrganizationMember(user, organizationId))) return errorResponse("Document not found.", 404);

    const { firestore, storage } = getFirebaseAdmin();
    const documentRef = firestore.collection("organizations").doc(organizationId).collection("documents").doc(id);
    const document = await documentRef.get();
    if (!document.exists) return errorResponse("Document not found.", 404);
    const version = await documentRef.collection("versions").doc(`v${document.get("version")}`).get();
    const storagePath = version.get("originalStoragePath");
    if (typeof storagePath !== "string" || !storagePath.startsWith(`organizations/${organizationId}/documents/${id}/`)) {
      return errorResponse("Original PDF is unavailable.", 404);
    }

    const [bytes] = await storage.bucket().file(storagePath).download();
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=\"document.pdf\"",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) return errorResponse(cause.message, 401);
    console.error("PDF download failed", cause);
    return errorResponse("Unable to retrieve the document.", 503);
  }
}
