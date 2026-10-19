import { loadApiDocument, toApiDocument } from "@/lib/api/documents";
import { ApiError, apiJson, handleApiRequest } from "@/lib/api/http";
import { isUuid } from "@/lib/supabase/documents";

export const runtime = "nodejs";

/** A document's status and its recipients' progress. */
export async function GET(request: Request, routeContext: RouteContext<"/api/v1/documents/[id]">) {
  return handleApiRequest(request, async (context) => {
    const { id } = await routeContext.params;
    if (!isUuid(id)) throw new ApiError(404, "not_found", "Document not found.");
    const { document, recipients, fieldCount } = await loadApiDocument(context, id);
    return apiJson(context.requestId, { document: toApiDocument(document, recipients, fieldCount) });
  });
}
