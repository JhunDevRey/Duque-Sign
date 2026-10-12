import { PDFDocument } from "pdf-lib";
import type { DocumentSummary, Delivery, Field, Recipient, RecipientStatus } from "@/lib/domain/types";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_PAGES } from "@/lib/config/app";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { getSessionUser, UnauthenticatedError } from "@/lib/firebase/session";
import { requireOrganizationMember } from "@/lib/firebase/tenant";

export const runtime = "nodejs";

type RecipientInput = {
  name: string;
  email: string;
  role: string;
  delivery: Delivery;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return Boolean(origin && new URL(origin).origin === new URL(request.url).origin);
}

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

function toIso(value: unknown): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate().toISOString();
  }
  return typeof value === "string" ? value : new Date(0).toISOString();
}

function serializeRecipient(id: string, data: FirebaseFirestore.DocumentData): Recipient {
  if (
    typeof data.name !== "string" ||
    typeof data.email !== "string" ||
    typeof data.role !== "string" ||
    typeof data.order !== "number" ||
    (data.delivery !== "email" && data.delivery !== "link") ||
    !["waiting", "sent", "viewed", "signed", "declined"].includes(data.status)
  ) {
    throw new Error(`Recipient ${id} has invalid stored data.`);
  }
  return {
    id,
    name: data.name,
    email: data.email,
    role: data.role,
    order: data.order,
    delivery: data.delivery,
    status: data.status as RecipientStatus,
    signedAt: data.signedAt ? toIso(data.signedAt) : undefined,
  };
}

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId");
    if (!organizationId || organizationId.length > 128) return jsonError("Organization ID is required.", 400);
    if (!(await requireOrganizationMember(user, organizationId))) return jsonError("Organization not found.", 404);

    const { firestore } = getFirebaseAdmin();
    const documentSnapshots = await firestore
      .collection("organizations")
      .doc(organizationId)
      .collection("documents")
      .orderBy("updatedAt", "desc")
      .limit(100)
      .get();

    const documents = await Promise.all(documentSnapshots.docs.map(async (snapshot) => {
      const data = snapshot.data();
      const recipientsSnapshot = await snapshot.ref.collection("recipients").orderBy("order").get();
      const fieldsSnapshot = await snapshot.ref.collection("fields").get();
      return {
        id: snapshot.id,
        title: data.title,
        status: data.status,
        externalId: data.externalId ?? undefined,
        originalFileName: data.originalFileName,
        originalPdfStorage: data.originalPdfStorage ?? (data.originalFileName ? "cloud" : undefined),
        version: data.version,
        pageCount: data.pageCount,
        createdBy: data.createdByName ?? data.createdBy,
        createdAt: toIso(data.createdAt),
        updatedAt: toIso(data.updatedAt),
        sentAt: data.sentAt ? toIso(data.sentAt) : undefined,
        completedAt: data.completedAt ? toIso(data.completedAt) : undefined,
        expiresAt: data.expiresAt ? toIso(data.expiresAt) : undefined,
        finalSha256: data.finalSha256 ?? undefined,
        recipients: recipientsSnapshot.docs.map((recipient) => serializeRecipient(recipient.id, recipient.data())),
        fields: fieldsSnapshot.docs.map((field) => ({ ...field.data(), id: field.id }) as Field),
      } satisfies DocumentSummary;
    }));

    return Response.json({ documents }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) return jsonError(cause.message, 401);
    console.error("Document list failed", cause);
    return jsonError("Unable to load documents. Check Firebase server configuration.", 503);
  }
}

export async function POST(request: Request) {
  let uploadedPath: string | null = null;
  try {
    const user = await getSessionUser();
    if (!isSameOrigin(request)) return jsonError("Invalid request origin.", 403);
    const form = await request.formData();
    const organizationId = form.get("organizationId");
    const title = form.get("title");
    const externalId = form.get("externalId");
    const file = form.get("file");
    const pdfStorage = form.get("pdfStorage");
    const requestedDocumentId = form.get("documentId");

    if (typeof organizationId !== "string" || !organizationId || organizationId.length > 128) {
      return jsonError("Organization ID is required.", 400);
    }
    if (typeof title !== "string" || title.trim().length < 1 || title.trim().length > 180) {
      return jsonError("Document title must be 1–180 characters.", 400);
    }
    if (externalId !== null && typeof externalId !== "string") return jsonError("External reference must be text.", 400);
    if (typeof externalId === "string" && externalId.trim().length > 120) return jsonError("External reference is too long.", 400);
    if (pdfStorage !== "browser" && pdfStorage !== "cloud") return jsonError("PDF storage mode is invalid.", 400);
    let localDocumentId: string | undefined;
    if (pdfStorage === "browser") {
      if (typeof requestedDocumentId !== "string" || !/^doc_[a-zA-Z0-9_-]{1,100}$/.test(requestedDocumentId)) {
        return jsonError("A valid browser draft ID is required.", 400);
      }
      localDocumentId = requestedDocumentId;
    }
    if (pdfStorage === "cloud" && !process.env.FIREBASE_STORAGE_BUCKET) {
      return jsonError("Cloud Storage is not configured. Choose browser-only PDF storage or configure a Storage bucket.", 503);
    }
    if (!(file instanceof File)) return jsonError("Upload a PDF file.", 400);
    if (file.size < 1 || file.size > MAX_UPLOAD_BYTES) return jsonError("PDF file size exceeds the allowed limit.", 413);
    if (file.type !== "application/pdf" && !file.name.toLocaleLowerCase().endsWith(".pdf")) {
      return jsonError("Only PDF documents are accepted.", 415);
    }

    const recipients = parseRecipients(form.get("recipients"));
    if (!recipients) return jsonError("Recipients are invalid or duplicated.", 400);
    const membership = await requireOrganizationMember(user, organizationId);
    if (!membership) return jsonError("Organization not found.", 404);

    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") return jsonError("The uploaded file is not a valid PDF.", 415);
    let pageCount: number;
    try {
      const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
      pageCount = pdf.getPageCount();
    } catch {
      return jsonError("The PDF is malformed or encrypted and cannot be processed.", 422);
    }
    if (pageCount < 1 || pageCount > MAX_UPLOAD_PAGES) {
      return jsonError(`PDF must contain between 1 and ${MAX_UPLOAD_PAGES} pages.`, 422);
    }

    const { firestore, storage, fieldValue } = getFirebaseAdmin();
    const organizationRef = firestore.collection("organizations").doc(organizationId);
    const documentCollection = organizationRef.collection("documents");
    const documentRef = localDocumentId
      ? documentCollection.doc(localDocumentId)
      : documentCollection.doc();
    const versionRef = documentRef.collection("versions").doc("v1");
    const now = fieldValue.serverTimestamp();
    const storagePath = `organizations/${organizationId}/documents/${documentRef.id}/versions/v1/original.pdf`;
    const safeFileName = file.name.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 255) || "document.pdf";
    if (pdfStorage === "cloud") {
      const bucketFile = storage.bucket().file(storagePath);
      uploadedPath = storagePath;
      await bucketFile.save(bytes, {
        resumable: false,
        validation: "crc32c",
        preconditionOpts: { ifGenerationMatch: 0 },
        metadata: {
          contentType: "application/pdf",
          cacheControl: "private, no-store",
          metadata: { organizationId, documentId: documentRef.id, version: "1" },
        },
      });
    }

    const savedRecipients = recipients.map((recipient) => {
      const ref = documentRef.collection("recipients").doc();
      return {
        ref,
        data: {
          ...recipient,
          email: recipient.email.toLocaleLowerCase(),
          order: recipients.indexOf(recipient) + 1,
          status: "waiting",
          createdAt: now,
        },
      };
    });
    const batch = firestore.batch();
    batch.create(documentRef, {
      title: title.trim(),
      externalId: typeof externalId === "string" && externalId.trim() ? externalId.trim() : null,
      status: "draft",
      version: 1,
      pageCount,
      originalFileName: safeFileName,
      originalPdfStorage: pdfStorage,
      createdBy: user.uid,
      createdByName: user.name ?? user.email ?? user.uid,
      createdAt: now,
      updatedAt: now,
    });
    batch.create(versionRef, {
      version: 1,
      originalStoragePath: pdfStorage === "cloud" ? storagePath : null,
      originalPdfStorage: pdfStorage,
      originalFileName: safeFileName,
      pageCount,
      createdAt: now,
      createdBy: user.uid,
    });
    for (const recipient of savedRecipients) batch.create(recipient.ref, recipient.data);
    batch.create(documentRef.collection("auditEvents").doc(), {
      actorType: "user",
      actorId: user.uid,
      actorLabel: user.email ?? user.uid,
      action: "document.created",
      createdAt: now,
    });
    await batch.commit();
    uploadedPath = null;

    const createdAt = new Date().toISOString();
    const result: DocumentSummary = {
      id: documentRef.id,
      title: title.trim(),
      status: "draft",
      externalId: typeof externalId === "string" && externalId.trim() ? externalId.trim() : undefined,
      originalFileName: safeFileName,
      originalPdfStorage: pdfStorage,
      version: 1,
      pageCount,
      createdBy: user.name ?? user.email ?? user.uid,
      createdAt,
      updatedAt: createdAt,
      recipients: savedRecipients.map(({ ref, data }) => ({
        id: ref.id,
        name: data.name,
        email: data.email,
        role: data.role,
        order: data.order,
        delivery: data.delivery,
        status: "waiting",
      })),
    };
    return Response.json({ document: result }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (uploadedPath) {
      try {
        const { storage } = getFirebaseAdmin();
        await storage.bucket().file(uploadedPath).delete({ ignoreNotFound: true });
      } catch (cleanupError) {
        console.error("Failed to remove orphaned uploaded PDF", cleanupError);
      }
    }
    if (cause instanceof UnauthenticatedError) return jsonError(cause.message, 401);
    console.error("Document upload failed", cause);
    return jsonError("Unable to save the draft. Check Firebase configuration and Firestore access.", 503);
  }
}
