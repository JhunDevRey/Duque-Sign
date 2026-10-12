# MVP Scope — Duque Sign

This project is the MVP for a multi-tenant electronic-signature platform designed to replace PandaDoc in a server-to-server workflow for a Canadian immigration consultancy.

## Goals

- Create, send, sign, finalize, archive, and retrieve signed PDFs.
- Support a multi-tenant organization model with strict isolation.
- Support API-first flow from Make.com or similar automation.
- Support signer delivery via email or return-a-link flow.
- Preserve document integrity with audit records, immutable final PDF records, and SHA-256 hashes.
- Generate recipient signing URLs with short expiry, single-recipient tokens, and clear revocation behavior.

## Core user and API flow

1. Upload a PDF to a tenant workspace.
2. Add signer recipients and assign fields.
3. Optionally place fields by anchor tags found in the PDF text layer.
4. Send document with `delivery: "email" | "link"`.
5. Recipient signs through a mobile-friendly signing portal.
6. Finalize PDF when all required recipients complete.
7. Post webhook notifications and allow status/final PDF retrieval.

## Scope priorities

1. Security
2. Document integrity
3. Signing reliability
4. Tenant isolation
5. API reliability
6. Webhook reliability
7. Usability
8. Visual polish
9. Advanced features

## Explicit exclusions

- AI features
- Blockchain
- Native mobile applications
- SSO/SCIM
- Unrelated analytics or CRM features
- Legal certification claims or compliance endorsements
- Anything not required to create, send, sign, finalize, audit, retrieve, or integrate a document

## Required MVP features

- Organization, members, roles, and RBAC
- PDF upload validation (type, size, pages, encryption/malform detection)
- Secure file storage and authorization
- Document CRUD, status lifecycle, and audit log
- Field positioning by coordinates and anchor tags
- Template creation and reuse
- Signing portal for recipients
- Signer consent, evidence capture, and decline flow
- Final PDF flattening and certificate hash storage
- API keys, request validation, idempotency, rate limiting
- Webhooks with HMAC signatures and retry handling
- Dashboard counts backed by real queries
- Demo seed script and Playwright Definition of Done flow

## Definition of Done

The application must support an end-to-end workflow from organization creation to signed final document delivery and webhook notification, backed by persisted data and fully server-side enforcement of state changes.
