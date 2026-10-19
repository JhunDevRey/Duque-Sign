import type { Delivery } from "@/lib/domain/types";
import { inspectUploadedPdf } from "@/lib/pdf/validate";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  databaseErrorResponse,
  isOrganizationMember,
  isSameOrigin,
  isUuid,
  jsonError,
  ORIGINAL_PDF_BUCKET,
  originalPdfPath,
  toDocumentSummary,
  toRecipient,
} from "@/lib/supabase/documents";
import { getSession, UnauthenticatedError } from "@/lib/supabase/session";

export const runtime = "nodejs";

type RecipientInput = {
  name: string;
  email: string;
  role: string;
  delivery: Delivery;
};

function parseRecipients(value: FormDataEntryValue | null): RecipientInput[] | null {
  if (typeof value !== "string") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 20) return null;

  const recipients: RecipientInput[] = [];
  for (const item of parsed) {
    if (
      typeof item !== "object" ||
      item === null ||
      !("name" in item) ||
      !("email" in item) ||
      !("role" in item) ||
      !("delivery" in item) ||
      typeof item.name !== "string" ||
      typeof item.email !== "string" ||
      typeof item.role !== "string" ||
      (item.delivery !== "email" && item.delivery !== "link")
    ) {
      return null;
    }
    const name = item.name.trim();
    const email = item.email.trim();
    const role = item.role.trim();
    if (
      !name ||
      name.length > 120 ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !role ||
      role.length > 80
    ) {
      return null;
    }
    recipients.push({ name, email, role, delivery: item.delivery });
  }
  const emails = recipients.map((recipient) => recipient.email.toLocaleLowerCase());
  if (new Set(emails).size !== emails.length) return null;
  return recipients;
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await getSession();
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!isUuid(organizationId)) return jsonError("Organization ID is required.", 400);
    if (!(await isOrganizationMember(supabase, user.uid, organizationId))) return jsonError("Organization not found.", 404);

    const { data: documents, error: documentsError } = await supabase
      .from("documents")
      .select("*")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (documentsError) throw documentsError;
    if (documents.length === 0) return Response.json({ documents: [] }, { headers: { "Cache-Control": "no-store" } });

    const documentIds = documents.map((document) => document.id);
    const creatorIds = [...new Set(documents.map((document) => document.created_by))];
    const [recipientsResult, fieldsResult, profilesResult] = await Promise.all([
      supabase.from("recipients").select("*").in("document_id", documentIds).order("signing_order"),
      supabase.from("fields").select("*").in("document_id", documentIds),
      supabase.from("profiles").select("id, display_name, email").in("id", creatorIds),
    ]);
    if (recipientsResult.error) throw recipientsResult.error;
    if (fieldsResult.error) throw fieldsResult.error;
    if (profilesResult.error) throw profilesResult.error;

    const creatorLabels = new Map(
      profilesResult.data.map((profile) => [profile.id, profile.display_name ?? profile.email ?? "Unknown user"]),
    );
    const summaries = documents.map((document) => toDocumentSummary(
      document,
      recipientsResult.data.filter((recipient) => recipient.document_id === document.id),
      fieldsResult.data.filter((field) => field.document_id === document.id),
      creatorLabels.get(document.created_by) ?? "Unknown user",
    ));
    return Response.json({ documents: summaries }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) return jsonError(cause.message, 401);
    console.error("Document list failed", cause);
    return jsonError("Unable to load documents.", 503);
  }
}

export async function POST(request: Request) {
  let uploadedPath: string | null = null;
  try {
    const { supabase, user } = await getSession();
    if (!isSameOrigin(request)) return jsonError("Invalid request origin.", 403);
    const form = await request.formData();
    const organizationId = form.get("organizationId");
    const title = form.get("title");
    const externalId = form.get("externalId");
    const file = form.get("file");

    if (!isUuid(organizationId)) return jsonError("Organization ID is required.", 400);
    if (typeof title !== "string" || title.trim().length < 1 || title.trim().length > 180) {
      return jsonError("Document title must be 1–180 characters.", 400);
    }
    if (externalId !== null && typeof externalId !== "string") return jsonError("External reference must be text.", 400);
    if (typeof externalId === "string" && externalId.trim().length > 120) return jsonError("External reference is too long.", 400);
    const recipients = parseRecipients(form.get("recipients"));
    if (!recipients) return jsonError("Recipients are invalid or duplicated.", 400);
    if (!(await isOrganizationMember(supabase, user.uid, organizationId))) return jsonError("Organization not found.", 404);

    const pdf = await inspectUploadedPdf(file);
    if (!pdf.ok) return jsonError(pdf.message, pdf.status);
    const { bytes, pageCount, fileName: safeFileName } = pdf;

    const documentId = crypto.randomUUID();
    const storagePath = originalPdfPath(organizationId, documentId, 1);
    const trimmedExternalId = typeof externalId === "string" && externalId.trim() ? externalId.trim() : null;

    const { error: uploadError } = await supabase.storage
      .from(ORIGINAL_PDF_BUCKET)
      .upload(storagePath, bytes, { contentType: "application/pdf", upsert: false });
    if (uploadError) throw uploadError;
    uploadedPath = storagePath;

    const { data: savedRecipients, error: createError } = await supabase.rpc("create_draft_document", {
      p_document_id: documentId,
      p_organization_id: organizationId,
      p_title: title.trim(),
      p_external_id: trimmedExternalId,
      p_original_file_name: safeFileName,
      p_original_pdf_path: storagePath,
      p_page_count: pageCount,
      p_recipients: recipients,
    });
    if (createError) {
      await removeOrphanedPdf(storagePath);
      uploadedPath = null;
      return databaseErrorResponse(createError, "Unable to save the draft");
    }
    uploadedPath = null;

    const createdAt = new Date().toISOString();
    return Response.json({
      document: {
        id: documentId,
        title: title.trim(),
        status: "draft",
        externalId: trimmedExternalId ?? undefined,
        originalFileName: safeFileName,
        version: 1,
        pageCount,
        createdBy: user.name ?? user.email ?? user.uid,
        createdAt,
        updatedAt: createdAt,
        recipients: savedRecipients.map(toRecipient),
        fields: [],
      },
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (uploadedPath) await removeOrphanedPdf(uploadedPath);
    if (cause instanceof UnauthenticatedError) return jsonError(cause.message, 401);
    console.error("Document upload failed", cause);
    return jsonError("Unable to save the draft. Check Supabase configuration and storage access.", 503);
  }
}

// Members may upload but only admins may delete storage objects, so cleanup uses the server-only admin client.
async function removeOrphanedPdf(path: string) {
  try {
    const { error } = await createSupabaseAdminClient().storage.from(ORIGINAL_PDF_BUCKET).remove([path]);
    if (error) throw error;
  } catch (cleanupError) {
    console.error("Failed to remove orphaned uploaded PDF", path, cleanupError);
  }
}
