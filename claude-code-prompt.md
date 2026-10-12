# Claude Code Prompt — E-Signature Platform MVP

> **Before you paste this:** save the MVP scope document you already have into the repo as `docs/MVP_SCOPE.md`. This prompt points Claude Code at it instead of repeating it, so the spec stays the single source of truth. Edit the **STACK** block if you want something different.

---

You are a senior full-stack engineer building the MVP of a multi-tenant electronic-signature platform (an in-house alternative to PandaDoc/DocuSign). Treat this as production software: security, document integrity and signing correctness come before features and polish.

## 1. Source of truth

Read `docs/MVP_SCOPE.md` in full before doing anything else. It defines:
- the 15 MVP must-have feature areas
- the MVP Definition of Done (the end-to-end workflow)
- the explicit exclusions (do NOT build these)
- the priority order: Security → Document Integrity → Signing Reliability → Tenant Isolation → API Reliability → Webhook Reliability → Usability → Visual Polish → Advanced Features

If anything in this prompt conflicts with `docs/MVP_SCOPE.md`, the scope document wins — tell me about the conflict rather than silently choosing.

When a feature isn't clearly covered, apply the scope's rule: *if it doesn't directly help an organization create, send, securely sign, finalize, audit, retrieve, or integrate a document, defer it* and add it to `docs/DEFERRED.md`.

## 2. Context: the first real consumer

The first organization on this platform is a Canadian immigration consultancy whose current contract pipeline is:

WordPress webform → Make.com → Flask app on PythonAnywhere (generates the contract as DOCX) → staff convert to PDF → Slack approval → Make.com sends the contract for signature (currently PandaDoc via its API) → applicant gets a signing link in a Gmail email.

This platform will replace PandaDoc in that chain. So the API must comfortably support this server-to-server flow from Make.com's HTTP module:

1. `POST` a document with an uploaded PDF (multipart, or a fetchable file URL) plus recipient(s) and metadata such as an external reference number
2. Send it — with a choice of delivery: **platform sends the signing email**, or **return the signing URL only** so the caller sends its own email
3. Receive a signed webhook on `document.completed` (and other events) and fetch status / download the final PDF

Requirements that follow from this:
- Recipients must support a `delivery: "email" | "link"` option; for `"link"`, the send response returns a per-recipient signing URL. Signing URLs must still be single-recipient, expiring, revocable, and hashed at rest.
- Documents accept an `external_id` / `metadata` object that is echoed back in API responses and webhook payloads.
- Signature fields can be placed either by coordinates or by **text anchor tags** embedded in the PDF (e.g. `{{s:Client}}`, `{{i:Client}}`, `{{d:Client}}`) so templates generated from DOCX don't need manual field placement. Anchor tags must be found in the PDF text layer, converted to fields at the tag's position, and visually hidden/removed from the final PDF. Treat this as part of "Field positioning" in the MVP; keep the tag syntax simple and documented.
- Write a short `docs/integrations/make-com.md` showing the exact HTTP calls (create → send → webhook → download), including how to verify the webhook HMAC signature.

## 3. STACK (edit if needed)

Default choice unless I say otherwise:
- **App:** Next.js (App Router) + TypeScript, server-side rendering for authenticated pages, route handlers for `/api/v1/*`
- **DB:** PostgreSQL with Drizzle or Prisma and versioned migrations
- **Auth:** a maintained library (e.g. Auth.js or Lucia-style session auth) with DB-backed sessions, argon2id/bcrypt password hashing, email verification, password reset
- **Jobs:** Postgres-backed queue (e.g. pg-boss) for emails, webhook delivery, PDF finalization, reminders, expiry — no extra infra required
- **Files:** S3-compatible object storage behind a `StorageService` interface (local-disk adapter for dev)
- **PDF:** pdf.js for rendering/preview and anchor-tag text extraction; pdf-lib for stamping fields and generating the final PDF
- **Email:** `EmailService` interface with an SMTP adapter and one API-provider adapter; a dev adapter that writes emails to a local mailbox viewer
- **Tests:** Vitest for unit/integration, Playwright for the end-to-end Definition of Done
- **Local dev:** `docker compose` for Postgres + object storage + mail catcher

Hosting note: this needs a runtime that supports a long-running worker process (webhooks, retries, email). Shared PHP hosting and free-tier PythonAnywhere are not suitable; design for a container host or VPS, and document deployment in `docs/DEPLOYMENT.md`.

## 4. How to work

1. **Plan first.** Start in plan mode. After reading the scope, produce `docs/ARCHITECTURE.md` covering: data model (ERD in Mermaid), document & recipient state machines, tenant-isolation strategy, signing-token design, audit-log design, finalization/hashing flow, webhook delivery design, API conventions (errors, request IDs, idempotency, pagination), and the folder structure. Stop and wait for my approval before writing application code.
2. **Build in the phases below, one at a time.** At the end of each phase: run migrations, lint, typecheck and all tests; fix failures; then give me a short summary (what was built, how to try it, what's deferred, any decisions I should know about) and **wait for my go-ahead**.
3. **Commit** in small, logical commits with clear messages.
4. **Ask** when a decision is genuinely mine (legal wording, product behavior, anything irreversible). Otherwise pick the sensible default, note it in `docs/DECISIONS.md`, and keep going.
5. Keep `README.md` current: setup, env vars (`.env.example`, no real secrets), commands, and how to run the end-to-end test.

## 5. Phases

**Phase 0 — Foundation**
Repo scaffold, docker compose, DB + migrations, config/secrets loading, structured logging with request IDs, security headers, error format, test harness, CI script (lint + typecheck + test).
*Exit:* app boots, health check passes, empty test suite runs green.

**Phase 1 — Auth, organizations, RBAC, tenant isolation**
Registration, login, logout, sessions, email verification, password reset, organization creation, membership, Owner/Admin/Member roles. Every tenant-scoped query goes through a single enforced pattern (e.g. a repository layer or Postgres RLS) — never trust a client-provided org/user ID.
*Exit:* integration tests prove a user in Org A cannot read or mutate any Org B resource through UI routes or API.

**Phase 2 — Documents, storage, audit log**
PDF upload (validate type, size, page count; reject encrypted/malformed PDFs), secure file access (signed short-lived URLs or streamed through authorization), document CRUD/archive, versioning, the full document state machine enforced server-side, append-only audit events (no update/delete path for ordinary users; consider DB-level protection).
*Exit:* illegal state transitions are rejected by tests; every mutation writes an audit event.

**Phase 3 — Field editor & templates**
PDF preview with page navigation; place/move/resize signature, initials, text, date, checkbox fields; assign to recipients; required/optional; validation. Anchor-tag auto-detection. Templates: create from PDF, reusable fields, recipient roles, basic `{{variable}}` replacement, duplicate, create document from template.
*Exit:* a template with fields produces a document with correctly positioned fields, including from anchor tags.

**Phase 4 — Sending & the recipient signing portal**
Send flow, signing tokens (high-entropy, hashed at rest, expiring, single-recipient, replay-protected, revocable on cancel), signing email, the mobile-friendly signing portal (review → fill required fields → draw/type/upload signature → electronic consent → submit → confirmation), decline flow, signing order if multiple recipients. Capture the evidence listed in the scope (document ID + version, signer, session ID, timestamps, consent, IP/user agent, method).
*Exit:* a recipient can sign on a narrow mobile viewport; tampered/expired/reused tokens are rejected by tests.

**Phase 5 — Finalization**
When all required recipients complete: generate the final flattened PDF, append an audit certificate page (or separate certificate PDF), compute SHA-256, store immutably, lock the version, record completion, enqueue webhooks and completion emails. Any later change creates a new version.
*Exit:* tests confirm the stored hash matches the stored final PDF and that finalized documents cannot be silently modified.

**Phase 6 — API keys & REST API**
Scoped API keys (`sk_test_` / `sk_live_` prefixes, shown once, stored hashed, last-used, expiry, revoke), all endpoints from the scope plus what Section 2 needs, request validation, rate limiting, idempotency keys on mutations, consistent errors, request IDs, OpenAPI spec served at `/api/docs`.
*Exit:* API integration tests cover auth, scopes, tenant isolation, idempotency replay and rate limiting.

**Phase 7 — Webhooks & email**
Endpoint management, event selection, HMAC-SHA256 signatures with timestamp (and documented verification), event IDs, async delivery with exponential-backoff retries, delivery logs, manual redeliver, enable/disable. All transactional emails from the scope, including reminders and expiry handling via scheduled jobs.
*Exit:* a test receiver verifies signatures; failed deliveries retry and are logged.

**Phase 8 — Dashboard & admin**
Dashboard with real counts and recent activity (no hardcoded or fake numbers), org settings, members/roles, API keys, webhooks, templates, documents, usage, audit/activity views.
*Exit:* every number on the dashboard is backed by a query covered by a test.

**Phase 9 — Definition of Done & hardening**
A Playwright test that runs the entire MVP Definition of Done workflow against real persisted data (create org → … → webhook delivered and recorded → status retrieved via API). Security review pass against the scope's Security section, with findings and fixes listed in `docs/SECURITY_REVIEW.md`. Seed script for a demo org.
*Exit:* the full workflow test passes from a clean database.

## 6. Non-negotiables

- No mock UI behavior, fake data, or placeholder logic presented as working. If something isn't built yet, it is visibly marked as such.
- All sensitive state transitions (ownership, permissions, signing status, completion) are decided server-side.
- Never expose secret API keys, signing tokens, or file storage credentials to the browser.
- Don't claim legal validity of signatures or any compliance certification (SOC 2, ISO, HIPAA, etc.) anywhere in the UI, emails or docs. Consent text lives in configuration so it can be reviewed per jurisdiction.
- No AI features, blockchain, native mobile apps, SSO/SCIM, or any other item on the exclusions list.
- UI strings go through a simple message layer so localization is possible later.

Begin by reading `docs/MVP_SCOPE.md`, then enter plan mode and draft `docs/ARCHITECTURE.md`.
