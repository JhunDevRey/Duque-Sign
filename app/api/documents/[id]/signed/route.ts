import { finalizeDocument, SIGNED_PDF_BUCKET } from "@/lib/signing/finalize";
import { databaseErrorResponse, isOrganizationMember, isSameOrigin, isUuid, jsonError } from "@/lib/supabase/documents";
import { getSession, UnauthenticatedError } from "@/lib/supabase/session";

export const runtime = "nodejs";

/** Downloads the final signed PDF for organization members. */
export async function GET(request: Request, context: RouteContext<"/api/documents/[id]/signed">) {
  try {
    const { supabase, user } = await getSession();
    const { id } = await context.params;
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!isUuid(organizationId)) return jsonError("Organization ID is required.", 400);
    if (!isUuid(id)) return jsonError("Document not found.", 404);
    if (!(await isOrganizationMember(supabase, user.uid, organizationId))) return jsonError("Document not found.", 404);

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("title, final_pdf_path")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (documentError) throw documentError;
    if (!document) return jsonError("Document not found.", 404);
    const storagePath = document.final_pdf_path;
    if (!storagePath || !storagePath.startsWith(`${organizationId}/${id}/`)) {
      return jsonError("The signed PDF is not available yet.", 404);
    }

    const { data: blob, error: downloadError } = await supabase.storage.from(SIGNED_PDF_BUCKET).download(storagePath);
    if (downloadError) throw downloadError;
    const fileName = `${document.title.replace(/[^\w\s.-]+/g, "").trim().slice(0, 80) || "document"} (signed).pdf`;
    return new Response(blob, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) return jsonError(cause.message, 401);
    console.error("Signed PDF download failed", cause);
    return jsonError("Unable to retrieve the signed PDF.", 503);
  }
}

/** Retries final PDF generation for a fully signed document whose finalization failed. */
export async function POST(request: Request, context: RouteContext<"/api/documents/[id]/signed">) {
  try {
    if (!isSameOrigin(request)) return jsonError("Invalid request origin.", 403);
    const { supabase, user } = await getSession();
    const { id } = await context.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON request body.", 400);
    }
    const organizationId = typeof body === "object" && body !== null ? (body as Record<string, unknown>).organizationId : null;
    if (!isUuid(organizationId) || !isUuid(id)) return jsonError("Document not found.", 404);
    if (!(await isOrganizationMember(supabase, user.uid, organizationId))) return jsonError("Document not found.", 404);
    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("id")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (documentError) throw documentError;
    if (!document) return jsonError("Document not found.", 404);

    try {
      const { sha256 } = await finalizeDocument(id);
      return Response.json({ completed: true, sha256 }, { headers: { "Cache-Control": "no-store" } });
    } catch (cause) {
      if (typeof cause === "object" && cause !== null && "code" in cause && typeof cause.code === "string") {
        return databaseErrorResponse(cause as Parameters<typeof databaseErrorResponse>[0], "Unable to finalize the document");
      }
      throw cause;
    }
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) return jsonError(cause.message, 401);
    console.error("Finalization retry failed", cause);
    return jsonError("Unable to generate the signed PDF.", 503);
  }
}
