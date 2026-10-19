import { loadApiDocument } from "@/lib/api/documents";
import { ApiError, databaseError, handleApiRequest } from "@/lib/api/http";
import { finalizeDocument, SIGNED_PDF_BUCKET } from "@/lib/signing/finalize";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/supabase/documents";

export const runtime = "nodejs";

/** Downloads the final signed PDF (with its certificate page) once every recipient has signed. */
export async function GET(request: Request, routeContext: RouteContext<"/api/v1/documents/[id]/signed-pdf">) {
  return handleApiRequest(request, async (context) => {
    const { id } = await routeContext.params;
    if (!isUuid(id)) throw new ApiError(404, "not_found", "Document not found.");
    let { document, recipients } = await loadApiDocument(context, id);

    // Everyone signed but the PDF was not generated (e.g. a failure after the last signature): retry now.
    if (
      document.status === "in_progress" &&
      !document.final_pdf_path &&
      recipients.length > 0 &&
      recipients.every((recipient) => recipient.status === "signed")
    ) {
      try {
        await finalizeDocument(id);
      } catch (cause) {
        if (typeof cause === "object" && cause !== null && "code" in cause && typeof cause.code === "string") {
          throw databaseError(cause as Parameters<typeof databaseError>[0], "Unable to generate the signed PDF");
        }
        throw cause;
      }
      ({ document, recipients } = await loadApiDocument(context, id));
    }

    const storagePath = document.final_pdf_path;
    if (document.status !== "completed" || !storagePath) {
      throw new ApiError(409, "not_completed", `The signed PDF is available once every recipient has signed. Current status: ${document.status}.`);
    }
    if (!storagePath.startsWith(`${context.organizationId}/${id}/`)) {
      throw new ApiError(404, "not_found", "Document not found.");
    }

    const { data: blob, error } = await createSupabaseAdminClient().storage.from(SIGNED_PDF_BUCKET).download(storagePath);
    if (error) throw error;
    const fileName = `${document.title.replace(/[^\w\s.-]+/g, "").trim().slice(0, 80) || "document"} (signed).pdf`;
    return new Response(blob, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
        ...(document.final_pdf_sha256 ? { "X-Content-SHA256": document.final_pdf_sha256 } : {}),
      },
    });
  });
}
