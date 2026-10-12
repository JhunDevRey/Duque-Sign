# Architecture

## 1. System overview

The application is a SaaS-style e-signing platform with a Next.js app, Firebase Authentication, and Cloud Firestore. Cloud Storage awaits billing approval; the asynchronous job/worker platform remains undecided. The platform treats signing, document integrity, and tenant isolation as first-class requirements and keeps all state transitions server-side.

## 2. Firestore data model

Firestore uses organization-scoped collections for tenant-owned data. A starting layout is:

```text
organizations/{orgId}
  members/{memberId}
  documents/{documentId}
    recipients/{recipientId}
    fields/{fieldId}
    versions/{versionId}
    auditEvents/{eventId}
  templates/{templateId}
  apiKeys/{keyId}
  webhookEndpoints/{endpointId}
  webhookDeliveries/{deliveryId}
  idempotencyRecords/{key}
signingTokens/{tokenId}
```

Organization documents hold tenant settings. Document records hold status, title, external reference, version pointer, timestamps, and final PDF hash. Recipient, field, version, and audit-event records are separate subcollections to avoid unbounded parent documents and to support their access patterns. `signingTokens` is a top-level collection so a presented token can be looked up by its stored hash without trusting a tenant or document ID from the caller; each record still binds the token to one recipient and document. API keys and idempotency records are organization-scoped and store only key hashes or replay-safe results, never raw secrets.

Queries should follow tenant-scoped paths and use explicit Firestore indexes for supported filters, sorting, and pagination. Keep document summaries denormalized only where needed for list views, and update duplicated summary data through trusted server code.

## 3. State machines

### Document lifecycle

- draft
- sent
- in_progress
- completed
- declined
- cancelled
- expired

Server-side transitions are enforced through a single service layer. No client-supplied `status` values are trusted. An audit event is written for each mutation.

### Recipient lifecycle

- waiting
- sent
- viewed
- signed
- declined

The recipient signing token is single-use for a single recipient and is invalidated after use, expiry, or revocation.

## 4. Tenant isolation strategy

- Route handlers use the Firebase Admin SDK only on the server and pass through a repository/service layer that requires an authorized organization context for every tenant-owned read or write.
- The server derives the organization from an authenticated, verified membership; it never trusts a client-provided organization ID as proof of access.
- If any browser code accesses Firestore directly in the future, deny access by default in Firestore Security Rules and add emulator tests proving cross-tenant reads and writes are rejected. Admin SDK calls bypass those rules, so server authorization and narrowly scoped service-account IAM remain mandatory.
- Global IDs are opaque; tenant resources are never exposed solely because a caller knows an ID.

## 5. Signing token design

- Generate a high-entropy random value with a server-side secret and secure randomness.
- Store only a hash of the token (e.g. bcrypt/argon2-compatible hash), never the raw value.
- Token is single-recipient and expires after a configured TTL.
- Token is revoked when a document is cancelled or a signer is replaced.
- Reuse or replay is blocked by storing `used_at` and checking against the current status.

## 6. Audit log design

The audit log is append-only by application policy and records:

- actor type (`user`, `recipient`, `api_key`, `system`)
- actor label
- action name
- document ID and title when relevant
- timestamp
- IP address or request id when available

Ordinary users have no update/delete path. Firestore does not make a record immutable against privileged Admin SDK credentials, so access to service accounts must be restricted and audit collections must only be mutated by the trusted audit-writing service. This supports review but is not a claim of tamper-proof or certified storage.

## 7. Finalization and hashing flow

1. Verify all required signers have completed or the document is otherwise valid to finalize.
2. Flatten required fields and lock the PDF output.
3. Render a certificate or appended audit page.
4. Compute SHA-256 of the canonical final PDF bytes.
5. Store the finalized document version and hash reference; enforce no-overwrite behavior in the storage layer selected later.
6. Lock the version so later changes require a new document version.
7. Emit completion event, webhook(s), and completion email.

## 8. Webhook delivery design

- Webhooks are delivered asynchronously. The queue/worker product remains undecided; do not treat Firestore itself as a durable job queue.
- Each delivery includes timestamp, event type, payload digest, and signature.
- HMAC-SHA256 is computed over `${timestamp}.${body}`.
- Retries use exponential backoff and dead-letter handling.
- Failed deliveries are logged and can be manually retried by admins.
- Persist an event/delivery record before dispatch and make worker execution idempotent. Firestore transactions can atomically update a bounded set of Firestore records, but cannot include external email, storage, or HTTP side effects; use an outbox-style handoff and retry-safe workers.

## 9. API conventions

- Standard error envelope with request ID and timestamp
- Mutations accept idempotency keys and reject duplicate requests safely
- Pagination via `limit`/`cursor` or `page`/`per_page`
- All input validated against typed schema before use
- All access paths are tenant-scoped

## 10. Folder structure

```text
app/
  api/
    v1/
  (auth)/
  dashboard/
  documents/
  templates/
  settings/
components/
  shell/
  ui/
  preview/
lib/
  config/
  domain/
  i18n/
  preview/
public/
  samples/
  vendor/
scripts/
  generate-sample-pdf.mjs
```

## 11. Key engineering decisions

- Keep the app route handlers and service layer separate from the UI for easier API re-use.
- Use Cloud Firestore for application data. Firebase Authentication is selected. Cloud Storage awaits billing approval; the worker/queue platform remains undecided.
- Keep privileged Firestore access server-side; Admin SDK access bypasses Firestore Security Rules.
- Design around Firestore transaction limits and query/index constraints; do not model large or unbounded collections as arrays embedded in parent documents.
- Keep sample preview data isolated to `lib/preview` so the backend can replace it with real data later.
- Treat PDF canonicalization, field detection, and finalization as security-critical paths.
- Keep message strings centralized in `lib/i18n` to simplify future localization.

## 12. Current prototype boundary

The browser-local workspace is a development prototype, not the production persistence or security layer. It stores document metadata in `localStorage` and original PDFs in IndexedDB. It is device/browser scoped and can be cleared by the user or browser. It must not be used for real client documents. Email delivery, recipient signing, signing evidence, finalization, and webhook delivery still require implementation and testing.

## 13. Firebase implementation status

The Firebase project now has a Standard `(default)` Firestore database in Toronto (`northamerica-northeast2`), with delete protection enabled and deny-by-default Firestore rules deployed. The database is eligible for the first-database free quota, subject to the documented limits. `.firebaserc` sets the project's CLI alias. The repository includes Firebase email/password account creation, email verification, password reset, HTTP-only server session cookies, organization creation/membership, Firestore-backed draft metadata, and organization-scoped document listing/cancellation routes. Live auth and data routes still need end-to-end testing with a user account.

Cloud Storage was not provisioned because Firebase requires the Blaze pay-as-you-go plan to use it. Firebase-backed draft creation currently stores metadata and recipients in Firestore and the PDF in the creating browser's IndexedDB. The PDF is not synced and cannot be accessed from another browser/device; clearing local browser data removes it. Cloud-backed PDF upload/download requires management approval and a provisioned bucket.

The draft field editor is implemented for browser-local PDFs and as a tenant-authorized Firestore metadata API. It supports manual field placement, moving fields, recipient assignment, required/optional flags, and extracting `{{s:Role}}`, `{{i:Role}}`, `{{d:Role}}`, `{{c:Role}}`, and `{{t:Role}}` anchors from PDF text. Cloud Storage is still required to load Firebase-backed original PDFs. Anchor tags are not yet removed from a finalized PDF because finalization is not implemented.

The email delivery provider, signing-token workflow, recipient portal, finalization, webhook workers, and API keys still require implementation. Do not accept real signing traffic until those remaining parts are complete and reviewed.
