# Make.com integration

This guide connects the contract pipeline to Duque Sign:

> WordPress form → Make → Flask app (DOCX) → PDF → **Slack approval** → **Duque Sign** → applicant signs → signed PDF

When a staff member clicks **Approve** in Slack, Make uploads the contract PDF to Duque Sign, sends it, and emails the applicant their signing link from your Gmail account, as with PandaDoc today.

## Before you start

1. **Run migration `006_api_keys.sql`** on the Supabase project (after 001–005).
2. **Set `SUPABASE_SERVICE_ROLE_KEY`** in the app's environment (Vercel → Project → Settings → Environment Variables, and `.env.local` for local runs). The API and recipient signing both need it.
3. **Create an API key**: sign in as an owner or admin → **Settings → API keys → Create API key**. The key (`sk_live_…`) is shown once. Store it in Make right away; if it is lost, revoke it and create another.
4. **Use the production URL** (for example `https://sign.example.com`) as the base URL in Make. Signing links are built from the URL Make calls, so a preview URL would produce preview links.

## Put signature tags in the contract template

Duque Sign places fields where it finds these tags in the PDF text, so no one has to position fields by hand:

| Tag | Field |
|---|---|
| `{{s:Client}}` | Signature (required to send) |
| `{{i:Client}}` | Initials |
| `{{d:Client}}` | Date signed |
| `{{t:Client}}` | Text the signer fills in |
| `{{c:Client}}` | Checkbox |

`Client` is the recipient's **role**. For a second signer, use another role, e.g. `{{s:Spouse}}`, and send a recipient with `"role": "Spouse"`.

Add the tags to the DOCX template where each field should appear. **Format the tag text in white** (it stays readable to the PDF scanner): tags are not yet removed from the final signed PDF, so visible tags would be printed in it. Every recipient needs at least one `{{s:…}}` tag, or sending is refused.

### Where the recipient's email comes from

Take the applicant's name and email from the **data already in the Make scenario** (the WordPress form submission, or the data the Flask app used to build the contract). Do not read the email back out of the PDF: text extraction can break on line wraps, layout changes and multiple addresses. If the approval scenario does not have the email, include it in the Slack button's value (below) or look it up by contract reference in your Data store or Google Sheet.

## Scenario: Slack approval → send for signature

```
[Webhooks: Custom webhook] → [JSON: Parse JSON] → [Router]
                                                    ├─ Approve → [Google Drive: Download a file] → [HTTP: create document]
                                                    │             → [Filter: ready_to_send] → [HTTP: send] → [Gmail: Send an email]
                                                    │             → [Slack: reply in thread]
                                                    └─ Reject  → [Slack: reply in thread]
```

### 1. Receive the button click from Slack

1. In Make, add **Webhooks → Custom webhook** and copy its URL.
2. In your Slack app (api.slack.com → your app → **Interactivity & Shortcuts**), turn Interactivity on and set the **Request URL** to that webhook URL.
3. In the scenario that posts the approval request, give the buttons an `action_id` of `approve` / `reject` and put what the next step needs in `value`, as JSON text, for example:

   ```json
   {"ref": "CT-2026-0142", "drive_file_id": "1AbC…", "name": "Jane Doe", "email": "jane@example.com"}
   ```

4. Slack posts a form field named `payload` that contains JSON. Add **JSON → Parse JSON** on `payload`, then a second **Parse JSON** on `actions[1].value` to get your button data.

Make answers Slack with `200 Accepted` on its own, within Slack's 3-second limit.

**Security:** anyone in the workspace who sees the message can click it. Add a filter that only continues when `user.id` is one of your approvers' Slack user IDs, and that `team.id` is your workspace.

### 2. Route on the button

Add a **Router**:

- **Approve** route filter: `actions[1].action_id` *Equal to* `approve`
- **Reject** route filter: `actions[1].action_id` *Equal to* `reject` → reply in the Slack thread and stop.

### 3. Get the PDF

Use **Google Drive → Download a file** with the file ID from the button value (or **HTTP → Get a file** if the Flask app serves the PDF at a URL you can reach).

### 4. Create the document in Duque Sign

**HTTP → Make a request**

| Setting | Value |
|---|---|
| URL | `https://<your-domain>/api/v1/documents` |
| Method | `POST` |
| Headers | `Authorization`: `Bearer sk_live_…` · `Idempotency-Key`: `contract-{{ref}}` |
| Body type | `Multipart/form-data` |
| Parse response | Yes |

Multipart fields:

| Field | Type | Value |
|---|---|---|
| `file` | File | Data and file name from the Drive module |
| `title` | Text | `Service agreement – {{name}}` |
| `external_id` | Text | `{{ref}}` (echoed back in every response) |
| `recipient_name` | Text | `{{name}}` |
| `recipient_email` | Text | `{{email}}` |
| `recipient_role` | Text | `Client` (must match the tags) |
| `metadata` | Text | Optional JSON object, e.g. `{"slack_channel":"C0123","slack_ts":"1712.55"}` |

For more than one signer, replace the three `recipient_*` fields with one `recipients` field holding a JSON array in signing order:

```json
[{"name": "Jane Doe", "email": "jane@example.com", "role": "Client"},
 {"name": "John Doe", "email": "john@example.com", "role": "Spouse"}]
```

The `Idempotency-Key` makes a retry safe: if Make repeats the request (for example after a timeout), Duque Sign returns the first response instead of creating a second document. Reusing the key with different content is rejected with `422`.

Response (`201`), shortened:

```json
{
  "document": {
    "id": "8b0c…",
    "status": "draft",
    "external_id": "CT-2026-0142",
    "field_count": 2,
    "recipients": [{ "id": "…", "name": "Jane Doe", "email": "jane@example.com", "role": "Client", "status": "waiting" }]
  },
  "anchors": { "detected": true, "placed": 2, "unmatched_roles": [] },
  "ready_to_send": true,
  "warnings": []
}
```

### 5. Stop if the PDF has no signature tag

Add a filter after the create module: `ready_to_send` *Equal to* `true`. On the other branch, reply in Slack with the `warnings` text so staff can fix the template. The draft stays in Duque Sign, where fields can also be placed by hand.

### 6. Send it

**HTTP → Make a request**

| Setting | Value |
|---|---|
| URL | `https://<your-domain>/api/v1/documents/{{document.id}}/send` |
| Method | `POST` |
| Headers | `Authorization`: `Bearer sk_live_…` |
| Body type | Raw · `application/json` |
| Request content | `{"expires_in_days": 30}` (optional; 1–90, default 30) |
| Parse response | Yes |

Response (`200`), shortened:

```json
{
  "document": { "id": "8b0c…", "status": "sent", "expires_at": "2026-11-18T15:04:05Z" },
  "signing_links": [
    { "recipient_id": "…", "name": "Jane Doe", "email": "jane@example.com", "role": "Client",
      "signing_order": 1, "can_sign_now": true, "url": "https://<your-domain>/sign/…" }
  ]
}
```

Signing URLs appear **only in this response** (only their hashes are stored). Don't log them anywhere public. Sending twice returns `409`, so a retry cannot issue a second set of links. If a link is lost, reissue it from the document's page in Duque Sign.

### 7. Email the applicant

**Gmail → Send an email** (use an **Iterator** over `signing_links` when there are several signers):

- **To:** `signing_links[1].email`
- **Subject:** `Please sign: {{document.title}}`
- **Content:** your usual wording, with the link `signing_links[1].url` and the expiry date `document.expires_at`.

With several signers in order, everyone receives a link now. Later signers can open theirs, but signing unlocks only after the people before them have signed (`can_sign_now` is `false` until then).

### 8. Confirm in Slack

**Slack → Create a message** in the approval thread: "Sent to {{email}} for signature."

## After signing

Webhooks for `document.completed` are not built yet. Until they are, track completion with a scheduled scenario:

1. When you send, store `document.id` and `external_id` in a **Data store**.
2. Every hour (or as needed), for each open record, call **GET** `/api/v1/documents/{id}` and check `document.status`:
   - `completed`: download the signed PDF with **GET** `/api/v1/documents/{id}/signed-pdf` (the `X-Content-SHA256` header carries the stored hash), save it to Drive, notify Slack, and remove the record.
   - `declined`, `expired`, `cancelled`: notify Slack and remove the record.

## Reference

All requests need `Authorization: Bearer sk_live_…`. Responses are JSON (snake_case) and carry an `X-Request-Id` header.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/ping` | Check the key; returns your organization |
| `POST` | `/api/v1/documents` | Create a draft from a PDF (multipart) |
| `GET` | `/api/v1/documents/{id}` | Status and recipient progress |
| `POST` | `/api/v1/documents/{id}/send` | Send; returns signing URLs |
| `GET` | `/api/v1/documents/{id}/signed-pdf` | Final signed PDF (after everyone signs) |

Create fields (multipart): `file` (required PDF, ≤ 25 MB, ≤ 100 pages, not encrypted) · `title` (defaults to the file name) · `external_id` (≤ 120 chars) · `metadata` (JSON object, ≤ 8 KB) · `recipients` (JSON array) **or** `recipient_name` + `recipient_email` + `recipient_role` (default `Client`) · `fields` (optional JSON array of `{type, role, page, x, y, w, h, required?, label?}` with coordinates as fractions of the page from the top-left) · `detect_anchors` (default `true`).

Document statuses: `draft` → `sent` → `in_progress` → `completed`, or `declined` / `cancelled` / `expired`.
Recipient statuses: `waiting`, `sent`, `viewed`, `signed`, `declined`.

Errors look like this; quote `request_id` when reporting a problem:

```json
{ "error": { "code": "invalid_request", "message": "Recipient email is not a valid address." }, "request_id": "6a26…" }
```

| Status | `code` | Meaning |
|---|---|---|
| 400 | `invalid_request` | A field is missing or invalid; the message says which |
| 401 | `missing_api_key` / `invalid_api_key` | No key, or the key is wrong or revoked |
| 404 | `not_found` | No such document in your organization |
| 409 | `invalid_state` / `not_completed` / `request_in_progress` | E.g. sending a document twice, or the signed PDF isn't ready |
| 413 / 415 / 422 | `invalid_pdf`, `unsupported_media_type`, `idempotency_key_reused` | The PDF or request format was rejected |
| 5xx | `internal_error` / `unavailable` | Retry later; with an `Idempotency-Key` a create retry is safe |

Not available yet: platform-sent email (`delivery: "email"`), webhooks, rate limiting, and removing anchor tags from the final PDF.
