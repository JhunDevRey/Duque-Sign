// Shared domain types. The front end uses these today; the backend will adopt them
// as the API contract once it exists.

export const DOCUMENT_STATUSES = [
  "draft",
  "sent",
  "in_progress",
  "completed",
  "declined",
  "cancelled",
  "expired",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const RECIPIENT_STATUSES = ["waiting", "sent", "viewed", "signed", "declined"] as const;
export type RecipientStatus = (typeof RECIPIENT_STATUSES)[number];

export type Delivery = "email" | "link";

export const FIELD_TYPES = ["signature", "initials", "date", "text", "checkbox"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export type Recipient = {
  id: string;
  name: string;
  email: string;
  /** Template role this recipient fills, e.g. "Client". Used to match anchor tags. */
  role: string;
  /** 1-based signing order. Recipients with the same order sign in parallel. */
  order: number;
  delivery: Delivery;
  status: RecipientStatus;
  signedAt?: string;
};

/**
 * A field placed on a page. Coordinates are fractions (0–1) of the page's rendered
 * width/height with the origin at the top-left, so they are independent of zoom.
 */
export type Field = {
  id: string;
  type: FieldType;
  recipientId: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  required: boolean;
  label?: string;
  source: "manual" | "anchor";
};

/** A recipient's signing link. The URL is only available when it is issued. */
export type SigningLink = {
  recipientId: string;
  name: string;
  email: string;
  delivery: Delivery;
  status: RecipientStatus;
  url: string;
};

export type DocumentSummary = {
  id: string;
  title: string;
  status: DocumentStatus;
  externalId?: string;
  originalFileName?: string;
  version: number;
  pageCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  completedAt?: string;
  expiresAt?: string;
  finalSha256?: string;
  fields?: Field[];
  recipients: Recipient[];
};

export type ActorType = "user" | "recipient" | "api_key" | "system";

export type AuditEvent = {
  id: string;
  at: string;
  actorType: ActorType;
  actorLabel: string;
  action: string;
  documentId?: string;
  documentTitle?: string;
  ip?: string;
};

export type Template = {
  id: string;
  name: string;
  roles: string[];
  fieldCount: number;
  variables: string[];
  updatedAt: string;
};

export type MemberRole = "owner" | "admin" | "member";

export type Member = {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  status: "active" | "invited";
  joinedAt: string;
};

export type ApiKey = {
  id: string;
  name: string;
  /** Only the non-secret prefix is ever shown after creation. */
  displayPrefix: string;
  mode: "test" | "live";
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
  revokedAt?: string;
};

export const WEBHOOK_EVENTS = [
  "document.sent",
  "document.viewed",
  "document.signed",
  "document.completed",
  "document.declined",
  "document.cancelled",
  "document.expired",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export type WebhookEndpoint = {
  id: string;
  url: string;
  events: WebhookEvent[];
  enabled: boolean;
  createdAt: string;
};

export type WebhookDelivery = {
  id: string;
  endpointId: string;
  event: WebhookEvent;
  at: string;
  attempt: number;
  responseStatus?: number;
  outcome: "succeeded" | "failed" | "retrying";
};
