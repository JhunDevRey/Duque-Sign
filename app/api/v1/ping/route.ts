import { apiJson, handleApiRequest } from "@/lib/api/http";

export const runtime = "nodejs";

/** Checks an API key, e.g. from Make's connection test. */
export async function GET(request: Request) {
  return handleApiRequest(request, async (context) =>
    apiJson(context.requestId, { ok: true, organization: { id: context.organizationId, name: context.organizationName } }),
  );
}
