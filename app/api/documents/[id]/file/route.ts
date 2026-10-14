import { isOrganizationMember, isUuid, jsonError, ORIGINAL_PDF_BUCKET } from "@/lib/supabase/documents";
import { getSession, UnauthenticatedError } from "@/lib/supabase/session";

export const runtime = "nodejs";

export async function GET(request: Request, context: RouteContext<"/api/documents/[id]/file">) {
  try {
    const { supabase, user } = await getSession();
    const { id } = await context.params;
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!isUuid(organizationId)) return jsonError("Organization ID is required.", 400);
    if (!isUuid(id)) return jsonError("Document not found.", 404);
    if (!(await isOrganizationMember(supabase, user.uid, organizationId))) return jsonError("Document not found.", 404);

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("original_pdf_path")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (documentError) throw documentError;
    if (!document) return jsonError("Document not found.", 404);
    const storagePath = document.original_pdf_path;
    if (!storagePath || !storagePath.startsWith(`${organizationId}/${id}/`)) {
      return jsonError("Original PDF is unavailable.", 404);
    }

    const { data: blob, error: downloadError } = await supabase.storage.from(ORIGINAL_PDF_BUCKET).download(storagePath);
    if (downloadError) throw downloadError;
    return new Response(blob, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=\"document.pdf\"",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) return jsonError(cause.message, 401);
    console.error("PDF download failed", cause);
    return jsonError("Unable to retrieve the document.", 503);
  }
}
