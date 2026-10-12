# Duque Sign

Duque Sign is a Next.js prototype for an in-house DocuSign/PandaDoc-style electronic-signature platform. Its dashboard and document management screens are responsive. Browser-local mode supports PDF-backed drafts, search, filters, PDF previews, and draft field placement with PDF anchor-tag detection. Firebase Auth and Firestore integrations support draft metadata and field persistence; document sending and signing are not enabled.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Firebase status

The Firebase CLI is connected to the configured project. Its Standard `(default)` Firestore database has been created in **Toronto (`northamerica-northeast2`)** with delete protection enabled, and `firestore.rules` has been deployed. `.firebaserc` selects this project by default.

The first Firestore database has a free quota (1 GiB stored data, 50,000 document reads/day, 20,000 writes/day, and 20,000 deletes/day). Usage beyond the free quota may require billing or be unavailable on the free plan. Deleting this database and creating another does not provide a reset of the free database eligibility.

**Cloud Storage was not created or enabled.** Firebase requires the Blaze pay-as-you-go plan for Storage, even if usage may fall within no-cost allowances. Firebase drafts currently save metadata and recipients to Firestore while keeping the PDF in the creating browser's IndexedDB. The PDF is not synced and is unavailable on other browsers/devices. Cloud PDF upload requires management approval for billing and a provisioned bucket. No billing account or plan was changed.

The project already has a `.env.local` containing Firebase web and Admin settings. Keep it private; do not paste its contents into chat, issues, or source control. Email/password provider configuration may still need to be enabled in Firebase Console under **Authentication → Sign-in method**.

To redeploy the Firestore rules after changing them:

```powershell
firebase deploy --only firestore:rules
```

## Available scripts

- `npm run dev` — run the Next.js dev server
- `npm run build` — production build
- `npm run lint` — ESLint validation

## Project documentation

- `docs/MVP_SCOPE.md` — MVP scope and requirements
- `docs/ARCHITECTURE.md` — architecture and implementation status

## Preview and feature status

Without Firebase credentials, initial records are sample data and new drafts stay in this browser: metadata in `localStorage`, PDFs in IndexedDB. With Firebase configured, draft metadata and recipients are stored in Firestore and PDFs stay in that browser's IndexedDB until Cloud Storage is enabled. Clearing browser storage removes locally stored PDFs; cloud draft details remain. Do not use this prototype for real client documents.

Sending, signing links, recipient signatures, final PDF generation, email delivery, and webhook delivery are not implemented. Anchor tags are detected and represented as draft fields; they are not removed from a final PDF. Cloud Storage awaits management approval for billing; Firebase-mode PDF access is limited to the browser where each draft was created. Do not accept real signing traffic until the full workflow is implemented and reviewed.
