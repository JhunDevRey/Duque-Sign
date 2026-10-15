// SAMPLE DATA FOR THE UI PREVIEW ONLY.
// These fixture records are not real. New drafts are stored separately in the browser-local
// prototype workspace until the Firebase-backed persistence layer is implemented.

import type {
  ApiKey,
  AuditEvent,
  DocumentStatus,
  DocumentSummary,
  Member,
  Template,
  WebhookDelivery,
  WebhookEndpoint,
} from "@/lib/domain/types";

export const SAMPLE_PDF_URL = "/samples/sample-agreement.pdf";

export const sampleViewer = {
  name: "Sample User",
  email: "sample.user@example.com",
  role: "owner" as const,
  organization: "Sample Organization",
};

export const sampleDocuments: DocumentSummary[] = [
  {
    id: "doc_sample_01",
    title: "Service Agreement – A. Rivera",
    status: "in_progress",
    externalId: "REF-1042",
    version: 1,
    pageCount: 2,
    createdBy: "Sample User",
    createdAt: "2026-09-28T14:05:00Z",
    updatedAt: "2026-09-29T09:12:00Z",
    sentAt: "2026-09-28T14:20:00Z",
    expiresAt: "2026-10-12T14:20:00Z",
    recipients: [
      { id: "rcp_01", name: "A. Rivera", email: "a.rivera@example.com", role: "Client", order: 1, delivery: "email", status: "viewed" },
      { id: "rcp_02", name: "Sample User", email: "sample.user@example.com", role: "Consultant", order: 2, delivery: "email", status: "waiting" },
    ],
  },
  {
    id: "doc_sample_02",
    title: "Service Agreement – K. Osei",
    status: "completed",
    externalId: "REF-1039",
    version: 1,
    pageCount: 2,
    createdBy: "Sample User",
    createdAt: "2026-09-22T16:00:00Z",
    updatedAt: "2026-09-24T11:40:00Z",
    sentAt: "2026-09-22T16:10:00Z",
    completedAt: "2026-09-24T11:40:00Z",
    finalSha256: "3f1c9a0e5b7d2c4486a1e0f9b2d7c6a5e4f3b2a1c0d9e8f7a6b5c4d3e2f1a0b9",
    recipients: [
      { id: "rcp_03", name: "K. Osei", email: "k.osei@example.com", role: "Client", order: 1, delivery: "link", status: "signed", signedAt: "2026-09-23T19:02:00Z" },
      { id: "rcp_04", name: "Sample User", email: "sample.user@example.com", role: "Consultant", order: 2, delivery: "email", status: "signed", signedAt: "2026-09-24T11:40:00Z" },
    ],
  },
  {
    id: "doc_sample_03",
    title: "Retainer Agreement – M. Chen",
    status: "draft",
    version: 1,
    pageCount: 2,
    createdBy: "Sample User",
    createdAt: "2026-09-30T10:30:00Z",
    updatedAt: "2026-09-30T10:45:00Z",
    recipients: [
      { id: "rcp_05", name: "M. Chen", email: "m.chen@example.com", role: "Client", order: 1, delivery: "email", status: "waiting" },
    ],
  },
  {
    id: "doc_sample_04",
    title: "Service Agreement – J. Novak",
    status: "declined",
    externalId: "REF-1035",
    version: 1,
    pageCount: 2,
    createdBy: "Sample User",
    createdAt: "2026-09-18T13:00:00Z",
    updatedAt: "2026-09-19T08:22:00Z",
    sentAt: "2026-09-18T13:15:00Z",
    recipients: [
      { id: "rcp_06", name: "J. Novak", email: "j.novak@example.com", role: "Client", order: 1, delivery: "email", status: "declined" },
    ],
  },
  {
    id: "doc_sample_05",
    title: "Service Agreement – P. Singh",
    status: "expired",
    externalId: "REF-1021",
    version: 1,
    pageCount: 2,
    createdBy: "Sample User",
    createdAt: "2026-08-20T15:00:00Z",
    updatedAt: "2026-09-03T15:00:00Z",
    sentAt: "2026-08-20T15:05:00Z",
    expiresAt: "2026-09-03T15:05:00Z",
    recipients: [
      { id: "rcp_07", name: "P. Singh", email: "p.singh@example.com", role: "Client", order: 1, delivery: "email", status: "sent" },
    ],
  },
  {
    id: "doc_sample_06",
    title: "Retainer Agreement – L. Haddad",
    status: "cancelled",
    version: 2,
    pageCount: 2,
    createdBy: "Sample User",
    createdAt: "2026-09-10T12:00:00Z",
    updatedAt: "2026-09-11T09:00:00Z",
    sentAt: "2026-09-10T12:10:00Z",
    recipients: [
      { id: "rcp_08", name: "L. Haddad", email: "l.haddad@example.com", role: "Client", order: 1, delivery: "link", status: "sent" },
    ],
  },
];

export function getSampleDocument(id: string): DocumentSummary | undefined {
  return sampleDocuments.find((d) => d.id === id);
}

export function countSampleDocumentsByStatus(): Record<DocumentStatus, number> {
  const counts: Record<DocumentStatus, number> = {
    draft: 0,
    sent: 0,
    in_progress: 0,
    completed: 0,
    declined: 0,
    cancelled: 0,
    expired: 0,
  };
  for (const d of sampleDocuments) counts[d.status] += 1;
  return counts;
}

export const sampleAuditEvents: AuditEvent[] = [
  { id: "evt_10", at: "2026-09-30T10:45:00Z", actorType: "user", actorLabel: "Sample User", action: "document.fields_updated", documentId: "doc_sample_03", documentTitle: "Retainer Agreement – M. Chen", ip: "203.0.113.10" },
  { id: "evt_09", at: "2026-09-30T10:30:00Z", actorType: "user", actorLabel: "Sample User", action: "document.created", documentId: "doc_sample_03", documentTitle: "Retainer Agreement – M. Chen", ip: "203.0.113.10" },
  { id: "evt_08", at: "2026-09-29T09:12:00Z", actorType: "recipient", actorLabel: "a.rivera@example.com", action: "recipient.viewed", documentId: "doc_sample_01", documentTitle: "Service Agreement – A. Rivera", ip: "198.51.100.24" },
  { id: "evt_07", at: "2026-09-28T14:20:00Z", actorType: "api_key", actorLabel: "Make.com (sk_live_…7f2a)", action: "document.sent", documentId: "doc_sample_01", documentTitle: "Service Agreement – A. Rivera" },
  { id: "evt_06", at: "2026-09-28T14:05:00Z", actorType: "api_key", actorLabel: "Make.com (sk_live_…7f2a)", action: "document.created", documentId: "doc_sample_01", documentTitle: "Service Agreement – A. Rivera" },
  { id: "evt_05", at: "2026-09-24T11:40:05Z", actorType: "system", actorLabel: "System", action: "document.completed", documentId: "doc_sample_02", documentTitle: "Service Agreement – K. Osei" },
  { id: "evt_04", at: "2026-09-24T11:40:00Z", actorType: "user", actorLabel: "Sample User", action: "recipient.signed", documentId: "doc_sample_02", documentTitle: "Service Agreement – K. Osei", ip: "203.0.113.10" },
  { id: "evt_03", at: "2026-09-23T19:02:00Z", actorType: "recipient", actorLabel: "k.osei@example.com", action: "recipient.signed", documentId: "doc_sample_02", documentTitle: "Service Agreement – K. Osei", ip: "192.0.2.77" },
  { id: "evt_02", at: "2026-09-19T08:22:00Z", actorType: "recipient", actorLabel: "j.novak@example.com", action: "recipient.declined", documentId: "doc_sample_04", documentTitle: "Service Agreement – J. Novak", ip: "198.51.100.90" },
  { id: "evt_01", at: "2026-09-11T09:00:00Z", actorType: "user", actorLabel: "Sample User", action: "document.cancelled", documentId: "doc_sample_06", documentTitle: "Retainer Agreement – L. Haddad", ip: "203.0.113.10" },
];

export const sampleTemplates: Template[] = [
  { id: "tpl_sample_01", name: "Service Agreement", roles: ["Client", "Consultant"], fieldCount: 6, variables: ["client_name", "file_number"], updatedAt: "2026-09-15T12:00:00Z" },
  { id: "tpl_sample_02", name: "Retainer Agreement", roles: ["Client"], fieldCount: 3, variables: ["client_name"], updatedAt: "2026-09-02T09:30:00Z" },
];

export const sampleMembers: Member[] = [
  { id: "usr_01", name: "Sample User", email: "sample.user@example.com", role: "owner", status: "active", joinedAt: "2026-08-01T12:00:00Z" },
  { id: "usr_02", name: "Second User", email: "second.user@example.com", role: "admin", status: "active", joinedAt: "2026-08-05T12:00:00Z" },
  { id: "usr_03", name: "Invited User", email: "invited.user@example.com", role: "member", status: "invited", joinedAt: "2026-09-29T12:00:00Z" },
];

export const sampleApiKeys: ApiKey[] = [
  { id: "key_01", name: "Make.com", displayPrefix: "sk_live_…7f2a", mode: "live", scopes: ["documents:write", "documents:read"], createdAt: "2026-09-01T12:00:00Z", lastUsedAt: "2026-09-28T14:20:00Z" },
  { id: "key_02", name: "Local testing", displayPrefix: "sk_test_…91bc", mode: "test", scopes: ["documents:read"], createdAt: "2026-08-12T12:00:00Z", expiresAt: "2026-12-31T00:00:00Z" },
];

export const sampleWebhookEndpoints: WebhookEndpoint[] = [
  { id: "whe_01", url: "https://hook.example.com/sample-endpoint", events: ["document.completed", "document.declined", "document.expired"], enabled: true, createdAt: "2026-09-01T12:30:00Z" },
];

export const sampleWebhookDeliveries: WebhookDelivery[] = [
  { id: "whd_03", endpointId: "whe_01", event: "document.completed", at: "2026-09-24T11:40:07Z", attempt: 1, responseStatus: 200, outcome: "succeeded" },
  { id: "whd_02", endpointId: "whe_01", event: "document.declined", at: "2026-09-19T08:23:30Z", attempt: 2, responseStatus: 200, outcome: "succeeded" },
  { id: "whd_01", endpointId: "whe_01", event: "document.declined", at: "2026-09-19T08:22:04Z", attempt: 1, responseStatus: 503, outcome: "failed" },
];
