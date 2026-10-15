import { SIGNED_PDF_BUCKET } from "@/lib/signing/finalize";
import {
  clientEvidence,
  INVALID_LINK_MESSAGE,
  signingErrorResponse,
  tokenHashFromParam,
  type SigningSessionRecord,
} from "@/lib/signing/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError, ORIGINAL_PDF_BUCKET } from "@/lib/supabase/documents";

export const runtime = "nodejs";

/**
 * Streams the PDF a recipient may see: the signed PDF once the document is completed, otherwise the
 * original while the link is still usable. Declined, cancelled, and expired documents are not served.
 */
export async function GET(request: Request, context: RouteContext<"/api/sign/[token]/pdf">) {
  try {
    const tokenHash = tokenHashFromParam((await context.params).token);
    if (!tokenHash) return jsonError(INVALID_LINK_MESSAGE, 404);
    const { ip, userAgent } = clientEvidence(request);
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("open_signing_session", {
      p_token_hash: tokenHash,
      p_ip: ip,
      p_user_agent: userAgent,
    });
    if (error) return signingErrorResponse(error, "Unable to load this document");
    const session = data as unknown as SigningSessionRecord;

    let bucket: string;
    let path: string | null;
    if (session.state === "completed") {
      bucket = SIGNED_PDF_BUCKET;
      path = session.document.finalPdfPath;
    } else if (session.state === "ready" || session.state === "waiting" || session.state === "signed") {
      bucket = ORIGINAL_PDF_BUCKET;
      path = session.document.originalPdfPath;
    } else {
      return jsonError("This document is no longer available.", 410);
    }
    if (!path) return jsonError("The PDF is not available yet.", 404);

    const { data: file, error: downloadError } = await admin.storage.from(bucket).download(path);
    if (downloadError) throw downloadError;
    const download = new URL(request.url).searchParams.get("download") === "1";
    const fileName = `${session.document.title.replace(/[^\w\s.-]+/g, "").trim().slice(0, 80) || "document"}${session.state === "completed" ? " (signed)" : ""}.pdf`;
    return new Response(file, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"`,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (cause) {
    console.error("Signing PDF download failed", cause);
    return jsonError("Unable to load this document right now.", 503);
  }
}
