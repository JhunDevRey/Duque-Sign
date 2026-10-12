import type { Field, FieldType } from "@/lib/domain/types";
import { FIELD_TYPES } from "@/lib/domain/types";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { getSessionUser, UnauthenticatedError } from "@/lib/firebase/session";
import { requireOrganizationMember } from "@/lib/firebase/tenant";

export const runtime = "nodejs";
const MAX_FIELDS = 100;

function error(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function validField(value: unknown): value is Field {
  if (typeof value !== "object" || value === null) return false;
  const field = value as Record<string, unknown>;
  return (
    typeof field.id === "string" &&
    /^[a-zA-Z0-9_-]{1,100}$/.test(field.id) &&
    typeof field.recipientId === "string" &&
    /^[a-zA-Z0-9_-]{1,100}$/.test(field.recipientId) &&
    FIELD_TYPES.includes(field.type as FieldType) &&
    Number.isInteger(field.page) &&
    typeof field.page === "number" &&
    field.page >= 1 &&
    Number.isFinite(field.x) &&
    typeof field.x === "number" &&
    Number.isFinite(field.y) &&
    typeof field.y === "number" &&
    Number.isFinite(field.w) &&
    typeof field.w === "number" &&
    Number.isFinite(field.h) &&
    typeof field.h === "number" &&
    field.x >= 0 &&
    field.y >= 0 &&
    field.w > 0 &&
    field.h > 0 &&
    field.x + field.w <= 1.001 &&
    field.y + field.h <= 1.001 &&
    typeof field.required === "boolean" &&
    (field.source === "manual" || field.source === "anchor") &&
    (field.label === undefined || (typeof field.label === "string" && field.label.length <= 160))
  );
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function GET(
  request: Request,
  context: RouteContext<"/api/documents/[id]/fields">,
) {
  try {
    const user = await getSessionUser();
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    const { id } = await context.params;
    if (!organizationId || !/^[a-zA-Z0-9_-]{1,128}$/.test(organizationId)) return error("Organization ID is required.", 400);
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return error("Document not found.", 404);
    if (!(await requireOrganizationMember(user, organizationId))) return error("Document not found.", 404);
    const { firestore } = getFirebaseAdmin();
    const documentRef = firestore.collection("organizations").doc(organizationId).collection("documents").doc(id);
    const document = await documentRef.get();
    if (!document.exists) return error("Document not found.", 404);
    const fields = await documentRef.collection("fields").get();
    return Response.json(
      { fields: fields.docs.map((field) => ({ ...field.data(), id: field.id })) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) return error(cause.message, 401);
    console.error("Document field read failed", cause);
    return error("Unable to load document fields.", 503);
  }
}

export async function PUT(
  request: Request,
  context: RouteContext<"/api/documents/[id]/fields">,
) {
  try {
    if (!isSameOrigin(request)) return error("Invalid request origin.", 403);
    const user = await getSessionUser();
    const { id } = await context.params;
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return error("Document not found.", 404);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return error("Invalid JSON request body.", 400);
    }
    const bodyRecord = typeof body === "object" && body !== null ? body as Record<string, unknown> : null;
    const organizationId = bodyRecord?.organizationId;
    const fields = bodyRecord?.fields;
    if (typeof organizationId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(organizationId)) {
      return error("Organization ID is required.", 400);
    }
    if (!Array.isArray(fields) || fields.length > MAX_FIELDS || !fields.every(validField)) {
      return error(`Fields must be valid and no more than ${MAX_FIELDS}.`, 400);
    }
    if (new Set(fields.map((field) => field.id)).size !== fields.length) {
      return error("Field IDs must be unique.", 400);
    }
    if (!(await requireOrganizationMember(user, organizationId))) return error("Document not found.", 404);

    const { firestore, fieldValue } = getFirebaseAdmin();
    const documentRef = firestore.collection("organizations").doc(organizationId).collection("documents").doc(id);
    const fieldCollection = documentRef.collection("fields");
    const recipientIds = [...new Set(fields.map((field) => field.recipientId))];
    const recipientRefs = recipientIds.map((recipientId) => documentRef.collection("recipients").doc(recipientId));
    const recipientSnapshots = await Promise.all(recipientRefs.map((reference) => reference.get()));
    if (recipientSnapshots.some((recipient) => !recipient.exists)) return error("A field references a recipient outside this document.", 400);

    await firestore.runTransaction(async (transaction) => {
      const document = await transaction.get(documentRef);
      if (!document.exists) throw new Error("NOT_FOUND");
      if (document.get("status") !== "draft") throw new Error("NOT_EDITABLE");
      const pageCount = document.get("pageCount");
      if (typeof pageCount !== "number" || !Number.isInteger(pageCount) || pageCount < 1) throw new Error("INVALID_DOCUMENT");
      if (fields.some((field) => field.page > pageCount)) throw new Error("INVALID_PAGE");
      const currentFields = await transaction.get(fieldCollection);
      const nextIds = new Set(fields.map((field) => field.id));
      for (const current of currentFields.docs) {
        if (!nextIds.has(current.id)) transaction.delete(current.ref);
      }
      const currentIds = new Set(currentFields.docs.map((field) => field.id));
      for (const field of fields) {
        const { id: fieldId, ...data } = field;
        const fieldRef = fieldCollection.doc(fieldId);
        if (currentIds.has(fieldId)) transaction.set(fieldRef, data);
        else transaction.create(fieldRef, data);
      }
      transaction.update(documentRef, { updatedAt: fieldValue.serverTimestamp() });
      transaction.create(documentRef.collection("auditEvents").doc(), {
        actorType: "user",
        actorId: user.uid,
        actorLabel: user.email ?? user.uid,
        action: "document.fields_updated",
        details: { fieldCount: fields.length },
        createdAt: fieldValue.serverTimestamp(),
      });
    });
    return Response.json({ ok: true, fieldCount: fields.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) return error(cause.message, 401);
    if (cause instanceof Error && cause.message === "NOT_FOUND") return error("Document not found.", 404);
    if (cause instanceof Error && cause.message === "NOT_EDITABLE") return error("Only draft documents can have their fields changed.", 409);
    if (cause instanceof Error && cause.message === "INVALID_PAGE") return error("A field references a page outside this document.", 400);
    if (cause instanceof Error && cause.message === "INVALID_DOCUMENT") return error("Document data is invalid.", 409);
    console.error("Document field update failed", cause);
    return error("Unable to save document fields.", 503);
  }
}
